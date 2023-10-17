<template>
  <div class="container is-fluid">
    <section>
    <div class="box">
      <b-field :label="getSetpointString">
        <b-slider v-model="tempSetpoint" size="is-large" :min="20.0" :max="100.0" :step="0.5" :bigger-slider-focus="true" lazy>
          <template v-for="val in tempArray">
            <b-slider-tick :value="val" :key="val"></b-slider-tick>
          </template>
        </b-slider>
      </b-field>
    </div>
    <div class="box">
    <b-field :label="getPowerString">
        <b-slider v-model="powerSetpoint" size="is-large" :min="100" :max="3000"  :step="100" :bigger-slider-focus="true" lazy>
          <template v-for="val in powerArray">
            <b-slider-tick :value="val" :key="val"></b-slider-tick>
          </template>
        </b-slider>
      </b-field>
    </div>
      <p>Current temp = {{ currTemp }}, Side = {{ currTempSide }}, Extra {{ currTempExtra }}</p>
      <p>Current power = {{ currPower }}</p>   
      <p>Temp setpoint = {{ tempSetpoint }}</p>
      <p>Max power setpoint = {{ powerSetpoint }}</p>
      <p>Element 1800 = {{ element1800 }}</p>
      <p>Element 1200 = {{ element1200 }}</p>
      <p>Time = {{ currentTime }}</p>     
    </section>
    <footer class="footer">
      <div class="content has-text-centered">
        <p>
          <strong>Bulma</strong> by <a href="https://jgthms.com">Jeremy Thomas</a>. The source code is licensed
          <a href="http://opensource.org/licenses/mit-license.php">MIT</a>. The website content
          is licensed <a href="http://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY NC SA 4.0</a>.
        </p>
      </div>
    </footer>
  </div>

</template>

<script>
let tempArray = []
let powerArray = []
for (let i = 0; i < 180; i++) {
  tempArray[i] = (i + 20) * 0.5
}
for (let i = 0; i <= 30; i++) {
  powerArray[i] = i * 100
}
// console.log(powerArray)
export default {
  // methods: {
  //   setTemp() {
  //     this.$store.commit('setTemp', this.setpoint.value)
  //   }
  // },
  name: 'Monitor',
  data: function () {    
    return { tempArray: tempArray, powerArray: powerArray}
  },
  mounted: function () {
    this.$store.dispatch('getAll')
  },
  computed: {
    getSetpointString() {
      return "Temperature setpoint: " + this.$store.state.tempSetpoint + "\xB0C"
    },
    getPowerString() {
      return "Maximum allowed power: " + this.$store.state.powerSetpoint + "W"
    },
    currTemp: function () {
      return this.$store.state.currentTemp
    },
    currTempSide: function () {
      return this.$store.state.currentTempSide
    },
    currTempExtra: function () {
      return this.$store.state.currentTempExtra
    },
    currPower: function () {
      return this.$store.state.currentPower
    },
    element1800: function () {
      return this.$store.state.element1800
    },
    element1200: function () {
      return this.$store.state.element1200
    },
    currentTime: function () {
      return new Date(Date.parse(this.$store.state.timeUTC))
    },
    tempSetpoint: {
      get () {
        return this.$store.state.tempSetpoint
      },
      set (value) {
        this.$store.dispatch('setTempSetpoint', value)
      }
    },
    powerSetpoint: {
      get () {
        return this.$store.state.powerSetpoint
      },
      set (value) {
        this.$store.dispatch('setPowerSetpoint', value)
      }
    }

  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
