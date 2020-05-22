const child_process = require('child_process')
const express = require('express')
const fs = require('fs')
var log4js = require('log4js')
var os = require('os')
var logger = log4js.getLogger()

logger.level = 'info'
logger.debug("Some debug messages") 


let currentTempBottom = -1.0
let tempSetpoint = 67.0
let safetySwitch = true
let power = 0.0
let currentPowerPhase = 0.0
let gpio1800State = 0
let gpio1200State = 0
const maxPowerPhase = 12.0
const HighPowerElemetRating = 1800.0
const LowPowerElemetRating = 1200.0
const localHostName = os.hostname()

const deviceNameBottom = '28-00000467ad4f'

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
    return parseInt(fs.readFileSync('/sys/class/gpio/gpio' + this.pinNr + '/value', '0'))
  }
}

const gpio1800 = new gpio()
const gpio1200 = new gpio()

gpio1800.export('18')
gpio1200.export('17')

//   function enableCooling() {
//     logger.info('enable cooling')
//     gpio115.set()
//     gpio49.reset()
//     heatStatus = 0
//   }

const measureTimerId = setInterval(() => {
  child_process.exec('cat /sys/devices/w1_bus_master1/' + deviceNameBottom + '/w1_slave', (error, stdout, stderr) => {
    if (error) {
      logger.error(`Failed to read temp, error: ${error}. Pulling the handbrake`)
      safetySwitch = false
      clearInterval(measureTimerId)
    }
    else {
      if (stdout.indexOf('YES') > 0) {
        currentTempBottom = parseInt(stdout.slice(stdout.indexOf('t=') + 2)) / 1000
        logger.info('currentTempBottom: ' + currentTempBottom + 'C')
        safetySwitch = true
      }
      else {
        safetySwitch = false
        logger.error('CRC error from DS18B20, disable heating')
      }

    }
  })
  child_process.exec('cat /sys/class/gpio/gpio17/value', (error, stdout, stderr) => {
    if (error) {
      logger.error(`Failed to read gpio17, error: ${error}. Pulling the handbrake`)
      safetySwitch = false
      clearInterval(measureTimerId)
    }
    else {
      gpio1200State = parseInt(stdout)
    }
  })
  child_process.exec('cat /sys/class/gpio/gpio18/value', (error, stdout, stderr) => {
    if (error) {
      logger.error(`Failed to read gpio18, error: ${error}. Pulling the handbrake`)
      safetySwitch = false
      clearInterval(measureTimerId)
    }
    else {
      gpio1800State = parseInt(stdout)
    }
  })
}, 1000)

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
  if (currentTempBottom < tempSetpoint) {
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
    'currentTemp': { 'bottom': currentTempBottom },
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

const server = app.listen( 9000, () => logger.info( 'Express server started!' ) )

process.on('exit', () => {
  gpio1800.unexport()
  gpio1200.unexport()
  logger.warning('Process exiting. Shut off heaters')
})