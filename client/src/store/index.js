/* eslint-disable no-console */
import Vue from 'vue'
import Vuex from 'vuex'
import http from 'http'
import { string } from 'postcss-selector-parser'
import axios from 'axios'

Vue.use(Vuex)
const API_HOST = 'http://192.168.10.204'
const API_PORT = ':9000'
const API_BASE = API_HOST + API_PORT
const store = new Vuex.Store({
  state: {
    currentTemp: -1,
    currentTempExtra: -1,
    currentTempSide: -1,
    tempSetpoint: 65,
    powerSetpoint: 0,
    currentPower: 0,
    avgPower: 0,
    element1800: 'Off',
    element1200: 'Off',
    timeUTC: undefined,
    hostname: 'DISCONNECTED'
  },
  mutations: {
    setTempSetpoint (state, temp) {
      state.tempSetpoint = temp
    },
    setCurrentTemp (state, temp) {
      state.currentTemp = temp
    },
    setCurrentTempExtra (state, temp) {
      state.currentTempExtra = temp
    },
    setCurrentTempSide (state, temp) {
      state.currentTempSide = temp
    },
    setCurrentPower (state, power) {
        state.currentPower = power.element1800 * 1800 + power.element1200 * 1200
    },
    setAvgPower (state, power) {
        state.avgPower = power
    },
    setElement1800 (state, onOff) {
      if (onOff === 1) {
        state.element1800 = 'On'
      } else {
        state.element1800 = 'Off'
      }
    },
    setElement1200 (state, onOff) {
      if (onOff === 1) {
        state.element1200 = 'On'
      } else {
        state.element1200 = 'Off'
      }
    },
    setHostname (state, hostname) {
      state.hostname = hostname
    },
    setPowerSetpoint (state, power) {
      state.powerSetpoint = power
    },
    setTimeUTC (state, time) {
      state.timeUTC = time
    }    
  },
  actions: {
    /* eslint-disable no-empty-pattern */
    setTempSetpoint ({}, value) {
      updateController('setTempSetpoint', value)
    },
    /* eslint-disable no-empty-pattern */
    setPowerSetpoint ({}, value) {
      updateController('setPowerSetpoint', value)
    },
    getAll ({ commit }) {
      // Make a request for a user with a given ID
      axios.get(API_BASE)
      .then(function (response) {
        if (response.data.hostname) {
          commit('setHostname', response.data.hostname)
        }
        if (response.data.timeUTC) {
          commit('setTimeUTC', response.data.timeUTC)
        }
        if (response.data.tempSetpoint) {
          commit('setTempSetpoint', response.data.tempSetpoint)
        }
        if (response.data.currentTemp) {
          commit('setCurrentTemp', response.data.currentTemp.bottom)
          commit('setCurrentTempExtra', response.data.currentTemp.extra)
          commit('setCurrentTempSide', response.data.currentTemp.side)
        }
        if (response.data.heatStatus) {
          commit('setElement1800', response.data.heatStatus.element1800)
          commit('setElement1200', response.data.heatStatus.element1200)
          commit('setCurrentPower', response.data.heatStatus)
        }
        if (response.data.maxPower) {
          commit('setPowerSetpoint', response.data.maxPower)
        }
        if (response.data.power) {
          commit('setAvgPower', response.data.power)
        }
        if (response.data.timeUTC) {
          commit('setTimeUTC', response.data.timeUTC)
        }
        
      //   {
      //     "hostname": "raspberrypi",
      //     "timeUTC": "2020-05-22T12:15:03.000Z",
      //     "tempSetpoint": 67,
      //     "currentTemp": {
      //         "bottom": 20.75
      //     },
      //     "heatStatus": {
      //         "element1800": 0,
      //         "element1200": 0
      //     },
      //     "power": 0,
      //     "extra": "blah"
      // }

        // handle success
        console.log(response)
      })
      .catch(function (error) {
        // handle error
	commit('setHostname', 'DICONNETED')
        console.log(error)
      })
      .then(function () {
        // always executed
      })
    },
    getTemp ({ commit }) {
      commitAPIFloat(commit, '/currentTemp', 'currentTemp1', 'currTemp')
    },
    getSetpoint ({ commit}) {
      commitAPIFloat(commit, '/setPoint', 'setPoint1', 'setTemp')
    }
  },
  modules: {
  }
})

async function updateController(action, value) {
  let endpoint = ''
  let data = undefined
  if (action === 'setTempSetpoint') {
    endpoint = '/setTempSetpoint'
    data = { 'tempSetpoint': value }
  } else if (action === 'setPowerSetpoint') {
    endpoint = '/setPowerSetpoint'
    data = { 'power': value }
  }
  console.log(API_BASE + endpoint)
  console.log(data)
  axios.post(API_BASE + endpoint, data)
  .then(function (response) {
    if (response.status >= 300) {
      console.log('Error: ' + response)
    }
    else {
      console.log(response.data)
    }
  })
  .catch(function (error) {
    // handle error
    console.log(error)
  })
}



async function commitAPIFloat(commit, endpoint, valueName, storeName) {
  // console.log(valueName)
  const options = {
    hostname: 'localhost',
    port: 9000,
    path: endpoint,
    method: 'GET',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*'
    }
  }
  
  const req = http.request(options, res => {
    // console.log(`statusCode: ${res.statusCode}`)
    // console.log(res)
    res.on('data', d => {
      console.log(JSON.parse(d))
      let value = parseFloat(JSON.parse(d)[valueName])
      if (!isNaN(value)) {
        commit(storeName, value)
      } else {
        console.error('Unparseable float (' + string(valueName) + '): ' + d[valueName])
      }
    })
  })
  
  req.on('error', error => {
    console.error(error)
  })
  
  req.end()
  return undefined
}

export default store

// setInterval(function () {
//   store.commit('currTemp', store.state.setpoint -0.5 + Math.random())
// }, 250)
setInterval(function () {
  store.dispatch('getAll')
}, 2000)
