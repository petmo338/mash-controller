'use strict'
const log4js = require('log4js')
const logger = log4js.getLogger()
logger.level = 'info'
logger.debug('Some debug messages')

/**
 *  PID Controller.
 */
class Controller {
  constructor (k_p, k_i, k_d, dt) {
    let i_max
    if (typeof k_p === 'object') {
      const options = k_p
      k_p = options.k_p
      k_i = options.k_i
      k_d = options.k_d
      dt = options.dt
      i_max = options.i_max
    }

    // PID constants
    this.k_p = typeof k_p === 'number' ? k_p : 1
    this.k_i = k_i || 0
    this.k_d = k_d || 0

    // Interval of time between two updates
    // If not set, it will be automatically calculated
    this.dt = dt || 0

    // Maximum absolute value of sumError
    this.i_max = i_max || 0
    this.o_max = 3000
    this.o_min = 0

    this.sumError = 0
    this.lastError = 0
    this.lastTime = 0

    this.target = 0 // default value, can be modified with .setTarget
  }

  setTarget (target) {
    this.target = target
  }

  update (currentValue) {
    if (!currentValue) throw new Error('Invalid argument')
    this.currentValue = currentValue

    // Calculate dt
    let dt = this.dt
    if (!dt) {
      const currentTime = Date.now()
      if (this.lastTime === 0) {
        // First time update() is called
        dt = 0
      } else {
        dt = (currentTime - this.lastTime) / 1000 // in seconds
      }
      this.lastTime = currentTime
    }
    if (typeof dt !== 'number' || dt === 0) {
      dt = 1
    }

    const error = this.target - this.currentValue
    if (Math.abs(error) < 10.0) {
      this.sumError = this.sumError + error * dt
    } else {
      this.sumError = 0
    }

    if (this.i_max > 0 && Math.abs(this.sumError) > this.i_max) {
      const sumSign = this.sumError > 0 ? 1 : -1
      this.sumError = sumSign * this.i_max
    }

    const dError = (error - this.lastError) / dt
    this.lastError = error
    // Limit output
    return Math.max(
      Math.min(
        this.k_p * error + this.k_i * this.sumError + this.k_d * dError,
        this.o_max
      ),
      this.o_min
    )
  }

  reset () {
    this.sumError = 0
    this.lastError = 0
    this.lastTime = 0
  }
}

module.exports = Controller
