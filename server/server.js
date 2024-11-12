require('dotenv').config()
const childProcess = require('child_process')
const express = require('express')
const fs = require('fs')
const log4js = require('log4js')
const os = require('os')
const logger = log4js.getLogger()
const { InfluxDB, Point } = require('@influxdata/influxdb-client')
const Controller = require('./controller')

logger.level = 'error'
logger.debug('Some debug messages')

let tempSetpoint = 67.0
let safetySwitch = true
let power = 0.0
let currentPowerPhase = 0.0
const maxPowerPhase = 12.0
const HighPowerElemetRating = 1800.0
const LowPowerElemetRating = 1200.0
const localHostName = os.hostname()
const CONTROL_INTERVAL_MS = 1000

const deviceNameGrain = '28-00000da6def7'
const deviceNameBottom = '28-01192de7eabb'
const deviceNameSide = '28-01192e17f017'

let PID = new Controller(300.0, 0.31, 0.0, CONTROL_INTERVAL_MS / 1000.0)
PID.setTarget(tempSetpoint)

class DS18B20 {
  constructor (deviceName, deviceString, flaky) {
    this.deviceName = deviceName
    this.temp = -1.0
    this.deviceString = deviceString
    this.doneFlag = true
    this.flaky = flaky
  }

  get currentTemp () {
    return this.temp
  }

  set currentTemp (temp) {
    this.temp = temp
  }

  measure () {
    this.doneFlag = false
    childProcess.exec(
      'cat /sys/devices/w1_bus_master1/' + this.deviceName + '/w1_slave',
      (error, stdout, stderr) => {
        if (error) {
          logger.error(
            `Failed to read temp, error: ${error}. Pulling the handbrake`
          )
          childProcess.exec(
            'echo 1 > /sys/devices/w1_bus_master1/w1_master_search',
            (error, stdout, stderr) => {}
          )
          if (!this.flaky) {
            safetySwitch = false
          }
        } else {
          if (stdout.indexOf('YES') > 0) {
            this.temp = parseInt(stdout.slice(stdout.indexOf('t=') + 2)) / 1000
            logger.info(this.deviceString + ': ' + this.currentTemp + 'C')
            safetySwitch = true
          } else {
            if (!this.flaky) {
              safetySwitch = false
            }

            logger.error(
              'CRC error from DS18B20, disable heating: output: ' +
                stdout +
                ', error: ' +
                error +
                ', stderr: ' +
                stderr
            )
          }
        }
        this.doneFlag = true
      }
    )
  }
}

class GPIO {
  _update (action, data) {
    let cmd
    if (action === 'export') {
      cmd = 'echo ' + this.pinNr + ' > /sys/class/gpio/export'
    } else if (action === 'unexport') {
      cmd = 'echo ' + this.pinNr + ' > /sys/class/gpio/unexport'
    } else if (action === 'direction') {
      cmd =
        'echo ' + data + ' > /sys/class/gpio/gpio' + this.pinNr + '/direction'
    } else if (action === 'value') {
      cmd = 'echo ' + data + ' > /sys/class/gpio/gpio' + this.pinNr + '/value'
    }
    if (cmd) {
      childProcess.execSync(cmd)
    }
  }

  export (pinNr) {
    this.pinNr = pinNr
    if (fs.existsSync('/sys/class/gpio/gpio' + this.pinNr + '/value')) {
      this.unexport()
    }
    this._update('export', undefined)
    this._update('direction', 'out')
    this._update('value', '0')
  }

  unexport () {
    this._update('direction', 'in')
    this._update('unexport', undefined)
  }

  set () {
    this._update('value', '1')
  }

  unset () {
    this._update('value', '0')
  }

  get () {
    return parseInt(
      fs.readFileSync('/sys/class/gpio/gpio' + this.pinNr + '/value')
    )
  }
}

const gpio1800 = new GPIO()
const gpio1200 = new GPIO()

gpio1800.export('76')
gpio1200.export('133')

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const tempSensorBottom = new DS18B20(
  deviceNameBottom,
  'Temp Sensor Bottom',
  false
)
// const tempSensorBottomExtra = new DS18B20(deviceNameBottomExtra, 'Temp Sensor Bottom Extra')
const tempSensorSide = new DS18B20(deviceNameSide, 'Temp Sensor Side', true)
const tempSensorGrain = new DS18B20(deviceNameGrain, 'Temp Sensor Grain', true)

async function measureForever () {
  childProcess.exec(
    'echo 1 > /sys/devices/w1_bus_master1/w1_master_timeout',
    (error, stdout, stderr) => {}
  )

  while (true) {
    const sensors = [tempSensorBottom, tempSensorSide, tempSensorGrain]
    childProcess.exec(
      'echo trigger > /sys/devices/w1_bus_master1/therm_bulk_read',
      (error, stdout, stderr) => {
        if (error) {
          logger.error(
            `Failed to trigger bulk_read, error: ${error}. Timing might be off`
          )
        }
      }
    )

    let conversionDone = false
    while (!conversionDone) {
      await sleep(200)
      childProcess.exec(
        'cat /sys/devices/w1_bus_master1/therm_bulk_read',
        (error, stdout, stderr) => {
          if (error) {
            logger.error(
              `Failed to read bulk_read, error: ${error}. Timing might be off`
            )
          }
          if (parseInt(stdout) >= 0) {
            conversionDone = true
          }
        }
      )
    }

    for (let i = 0; i < sensors.length; i++) {
      logger.info('Measure on device: ' + sensors[i].deviceString)
      sensors[i].measure()
    }
    await sleep(500)
  }
}

measureForever()

function controlPartialPower (pinHighPower, pinLowPower) {
  if (power > HighPowerElemetRating) {
    logger.info('>1800w desired')
    pinHighPower.set(1)
    const sp = (power - HighPowerElemetRating) / LowPowerElemetRating
    logger.info('sp: ' + sp + ', phase: ' + currentPowerPhase / maxPowerPhase)
    if (currentPowerPhase / maxPowerPhase < sp) {
      pinLowPower.set(1)
    } else {
      pinLowPower.unset()
    }
  } else {
    logger.info('<1800w desired')
    pinLowPower.unset()
    const sp = power / HighPowerElemetRating
    logger.info('sp: ' + sp + ', phase: ' + currentPowerPhase / maxPowerPhase)
    if (currentPowerPhase / maxPowerPhase < sp) {
      pinHighPower.set(1)
    } else {
      pinHighPower.unset()
    }
  }
}

setInterval(() => {
  power = PID.update(tempSensorGrain.currentTemp)
  logger.info('PID output: ' + power)

  if (tempSensorBottom.currentTemp < 102) {
    if (safetySwitch) {
      controlPartialPower(gpio1800, gpio1200)
    } else {
      // Shut down
      gpio1800.unset()
      gpio1200.unset()
    }
  } else {
    gpio1800.unset()
    gpio1200.unset()
  }
  currentPowerPhase += 1
  if (currentPowerPhase >= maxPowerPhase) {
    currentPowerPhase = 0
  }
}, CONTROL_INTERVAL_MS)

const writeApi = new InfluxDB({
  url: process.env.URL,
  token: process.env.TOKEN
}).getWriteApi('primary', process.env.BUCKET, 'ms')
// setup default tags for all writes through this API
writeApi.useDefaultTags({ location: localHostName })

setInterval(() => {
  logger.info('InfluxReportData')
  const point1 = new Point('temperature')
    .floatField('currentTempGrain', tempSensorGrain.currentTemp)
    .floatField('currentTempBottom', tempSensorBottom.currentTemp)
    .floatField('currentTempSide', tempSensorSide.currentTemp)
    .intField('heatStatus1800', gpio1800.get())
    .intField('heatStatus1200', gpio1200.get())
    .intField('powerSetpoint', power)
    .floatField('tempSetpoint', tempSetpoint)
    .floatField(
      'p_part',
      (tempSetpoint - tempSensorGrain.currentTemp) * PID.k_p
    )
    .floatField('i_part', PID.sumError * PID.k_i)
    .floatField(
      'd_part',
      (tempSetpoint - tempSensorGrain.currentTemp - PID.lastError) * PID.k_d
    )
  writeApi.writePoint(point1)
}, 1000)

const app = express()

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*') // update to match the domain you will make the request from
  res.header('Access-Control-Allow-Headers', '*')
  next()
})

app.get('/', function (req, res) {
  logger.info(req.body)
  const response = {
    hostname: localHostName,
    timeUTC: new Date(new Date().toUTCString()),
    tempSetpoint: tempSetpoint,
    currentTemp: {
      bottom: tempSensorGrain.currentTemp,
      side: tempSensorSide.currentTemp,
      extra: tempSensorBottom.currentTemp
    },
    heatStatus: { element1800: gpio1800.get(), element1200: gpio1200.get() },
    power: power,
    maxPower: PID.o_max,
    extra: 'blah'
  }
  res.send(response)
})

app.post('/setTempSetpoint', function (req, res) {
  logger.info(req.body)
  const tempSP = parseFloat(req.body.tempSetpoint)
  logger.info('POST: /setTempSetpoint' + tempSP)
  if (!isNaN(tempSP)) {
    tempSetpoint = tempSP
    PID.setTarget(tempSetpoint)
    res.send({ tempSetpoint: tempSetpoint })
  } else {
    res.status(400).send('Bad Request')
  }
})

app.post('/setPowerSetpoint', function (req, res) {
  logger.info(req.body)
  const tempPower = parseInt(req.body.power)
  logger.info('POST: /setPowerSetpoint' + tempPower)
  if (!isNaN(tempPower)) {
    PID.o_max = tempPower
    res.send({
      power: power
    })
  } else {
    res.status(400).send('Bad Request')
  }
})

app.post('/setPID', function (req, res) {
  logger.info(req.body)
  PID = new Controller(
    parseFloat(req.body.k_p),
    parseFloat(req.body.k_i),
    parseFloat(req.body.k_d),
    CONTROL_INTERVAL_MS / 1000.0
  )
  PID.setTarget(tempSetpoint)
  res.send({
    k_p: PID.k_p,
    k_i: PID.k_i,
    k_d: PID.k_d
  })
})

app.listen(9000, () => logger.info('Express server started!'))

process.on('exit', () => {
  gpio1800.unexport()
  gpio1200.unexport()
  logger.warn('Process exiting. Shut off heaters')
})
