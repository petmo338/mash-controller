const child_process = require('child_process')
const express = require('express')
const https = require('https')
const fs = require('fs')
var log4js = require('log4js')
var os = require('os')
var logger = log4js.getLogger()

logger.level = 'warning'
logger.debug("Some debug messages") 


let currentTempBottom = -1.0
let tempSetpoint = 67.0
let safetySwitch = true
let doneFlag = true
let power = 0.0
let currentPowerPhase = 0.0
let gpio1800State = 0
let gpio1200State = 0
const maxPowerPhase = 12.0
const HighPowerElemetRating = 1800.0
const LowPowerElemetRating = 1200.0
const localHostName = os.hostname()

const deviceNameBottom = '28-00000467ad4f'
const deviceNameBottomExtra = '28-01192de7eabb'
const deviceNameSide = '28-01192e17f017'

class DS18B20 {
  constructor(deviceName, deviceString) {
    this.deviceName = deviceName
    this.currentTemp = -1.0
    this.deviceString = deviceString
  }
  get currentTemp() {
    return this.currentTemp
  }
  measure() {
    child_process.exec('cat /sys/devices/w1_bus_master1/' + this.deviceName + '/w1_slave', (error, stdout, stderr) => {
      if (error) {
        logger.error(`Failed to read temp, error: ${error}. Pulling the handbrake`)
        safetySwitch = false
      }
      else {
        if (stdout.indexOf('YES') > 0) {
          this.currentTemp = parseInt(stdout.slice(stdout.indexOf('t=') + 2)) / 1000
          logger.info(this.deviceString + ': ' + this.currentTemp + 'C')
          safetySwitch = true
        }
        else {
          safetySwitch = false
          logger.error('CRC error from DS18B20, disable heating')
        }
      }
      doneFlag = true
    })
  }
}

class gpio {
  _update(action, data) {
    let cmd = undefined
    if (action === 'export') {
      cmd = 'echo ' + this.pinNr + ' > /sys/class/gpio/export'
    } else if (action == 'unexport') {
      cmd = 'echo ' + this.pinNr + ' > /sys/class/gpio/unexport'
    } else if (action == 'direction') {
      cmd = 'echo ' + data + ' > /sys/class/gpio/gpio' + this.pinNr + '/direction'
    } else if (action == 'value') {
      cmd = 'echo ' + data + ' > /sys/class/gpio/gpio' + this.pinNr + '/value'
    }
    if (cmd) {
      child_process.execSync(cmd)
    }
  }
  export(pinNr) {
    this.pinNr = pinNr
    if (fs.existsSync('/sys/class/gpio/gpio' + this.pinNr + '/value')) {
      this.unexport()
    }
    this._update('export', undefined)
    this._update('direction', 'out')
    this._update('value', '0')
    // fs.writeFileSync('/sys/class/gpio/export', this.pinNr)
    // fs.writeFileSync('/sys/class/gpio/gpio' + this.pinNr + '/direction', 'out')
    // fs.writeFileSync('/sys/class/gpio/gpio' + this.pinNr + '/value', '0')
  }
  unexport() {
    this._update('direction', 'in')
    this._update('unexport', undefined)
    // fs.writeFileSync('/sys/class/gpio/gpio' + this.pinNr + '/value', '0')
    // fs.writeFileSync('/sys/class/gpio/unexport', this.pinNr)
  }
  set() {
    this._update('value', '1')
    // fs.writeFileSync('/sys/class/gpio/gpio' + this.pinNr + '/value', '1')
  }
  unset() {
    this._update('value', '0')
    // fs.writeFileSync('/sys/class/gpio/gpio' + this.pinNr + '/value', '0')
  }
  get() {
    return parseInt(fs.readFileSync('/sys/class/gpio/gpio' + this.pinNr + '/value'))
  }
}

const gpio1800 = new gpio()
const gpio1200 = new gpio()

gpio1800.export('2')
gpio1200.export('3')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const tempSensorBottom = new DS18B20(deviceNameBottom, 'Temp Sensor Bottom')
const tempSensorBottomExtra = new DS18B20(deviceNameBottomExtra, 'Temp Sensor Bottom Extra')
const tempSensorSide = new DS18B20(deviceNameSide, 'Temp Sensor Side')

async function measureForever() {
  while (true) {
    sensors = [tempSensorBottom, tempSensorBottomExtra, tempSensorSide]
    for (i = 0; i < sensors.length; i++) {
      logger.info('Measure on device: ' + sensors[i].deviceString)
      while (!doneFlag) {
        logger.info('Measure on device: ' + sensors[i].deviceString + '. doneFlag' + doneFlag)
        await sleep(200)
      }
      doneFlag = false
      sensors[i].measure()
    }
    // }
    // sensors.foreach(device => {
    //   )  
  }
}

measureForever()

function controlPartialPower(pinHighPower, pinLowPower) {
  if (power > HighPowerElemetRating) {
    logger.info('>1800w desired')
    pinHighPower.set(1)
    let sp = (power - HighPowerElemetRating) / LowPowerElemetRating
    logger.info('sp: ' + sp + ', phase: ' + (currentPowerPhase / maxPowerPhase))
    if ((currentPowerPhase / maxPowerPhase) < sp) {
      pinLowPower.set(1)
    } else {
      pinLowPower.unset()
    }
  } else {
    logger.info('<1800w desired')
    pinLowPower.unset()
    let sp = power / HighPowerElemetRating
    logger.info('sp: ' + sp + ', phase: ' + (currentPowerPhase / maxPowerPhase))
    if ((currentPowerPhase / maxPowerPhase) < sp) {
      pinHighPower.set(1)
    } else {
      pinHighPower.unset()
    }
  }
}

const controlTimerId = setInterval(() => {
  if (tempSensorBottom.currentTemp < tempSetpoint) {
    if (safetySwitch) {
      controlPartialPower(gpio1800, gpio1200)
    } else {  // Shut down
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
}, 500)

const app = express()

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded


app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*") // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "*")
  next()
})

app.get('/', function (req, res) {
  logger.info(req.body)
  response = {
    'hostname': localHostName,
    'timeUTC': new Date(new Date().toUTCString()),
    'tempSetpoint': tempSetpoint,
    'currentTemp': {
      'bottom': tempSensorBottom.currentTemp,
      'bottomExtra': tempSensorBottomExtra.currentTemp,
      'side': tempSensorSide.currentTemp
    },
    'heatStatus': { 'element1800': gpio1800State, 'element1200': gpio1200State },
    'power': power,
    'extra': 'blah'
  }
  res.send(response)
})

app.post('/setTempSetpoint', function (req, res) {
  logger.info(req.body)
  tempSP = parseFloat(req.body.tempSetpoint)
  logger.info('POST: /setTempSetpoint' + tempSP)
  if (tempSP != NaN) {
    tempSetpoint = tempSP
    response = {
      'tempSetpoint': tempSetpoint
    }
    res.send(response)
  } else {
    res.status(400).send('Bad Request')
  }
})

app.post('/setPowerSetpoint', function (req, res) {
  logger.info(req.body)
  tempPower = parseInt(req.body.power)
  logger.info('POST: /setPowerSetpoint' + tempPower)
  if (tempPower != NaN) {
    power = tempPower
    response = {
      'power': power
    }
    res.send(response)
  } else {
    res.status(400).send('Bad Request')
  }
})

const httpsServer = https.createServer({
  key: fs.readFileSync('../snakeoil.key'),
  cert: fs.readFileSync('../snakeoil.cert')
}, app)
.listen(3000, function () {
  console.log('Example app listening on port 3000! Go to https://localhost:3000/')
})

const httpServer = app.listen( 9000, () => logger.info( 'Express server started!' ) )

process.on('exit', () => {
  gpio1800.unexport()
  gpio1200.unexport()
  logger.warn('Process exiting. Shut off heaters')
})
