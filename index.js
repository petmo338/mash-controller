var SPI = require('pi-spi')

var spi = SPI.initialize("/dev/spidev0.0")

//    test = Buffer.from([parseInt('10010110', 2), 0, 0, 0, 0])
var test = Buffer.from([parseInt('11010011', 2)])

resistor = 1000

function resistance (adReading) {
    
    return (resistor*resistor + resistor* (resistor+resistor)*voltage / vRef )/
        (resistor- (resistor+resistor)*voltage / vRef)
}


spi.clockSpeed(2e6)
// spi.dataMode(SPI.mode.CPHA | SPI.mode.CPOL)
// spi.dataMode(SPI.mode.CPOL)

console.log(test)

setInterval( function () {
    spi.write(test, function (e, d) {
    })
    spi.read(3, function (e, d) {
	var unsignedValue = (d[0] << 9) | (d[1] << 1) | d[2] > 7;
	var result = 0
	if (unsignedValue & 0x8000) {
    		// If the sign bit is set, then set the two first bytes in the result to 0xff.
    		result = unsignedValue | 0xffff0000;
	} else {
    		// If the sign bit is not set, then the result  is the same as the unsigned value.
    		result = unsignedValue;
	}
        console.log(d)
        console.log('Value: ' + result)
    })
    
},
500)

// spi.close(function () {})

// spi.transfer(test, test.length, function (e,d) {
//     console.log(d)
//     if (e) console.error(e)
//     // else console.log("Got \""+d+"\" back.")

//     // } else {
//     //     // NOTE: this will likely happen unless MISO is jumpered to MOSI
//     //     console.warn(e)
//     //     process.exit(-2)
//     // }
// })
