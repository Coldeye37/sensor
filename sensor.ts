
/**
 * 声音序号
 */
enum HetaoSoundIndex {
    //% block="1"
    one = 1,
    //% block="2"
    two,
    //% block="3"
    three,
    //% block="4"
    four,
    //% block="5"
    five,
    //% block="6"
    six
}

enum HetaoSoundVolume {
    //% block="100%"
    five = 5,
    //% block="80%"
    four = 4,
    //% block="60%"
    three = 3,
    //% block="40%"
    two = 2,
    //% block="20%"
    one = 1,
}

enum HetaoPingUnit {
    //% block="μs"
    MicroSeconds,
    //% block="cm"
    Centimeters,
    //% block="inches"
    Inches
}

enum HetaoTemperatureHumidity {
    //% block="温度°C"
    temperature,
    //% block="湿度%rh"
    humidity
}

//% weight=5 color=#FF7A4B icon="\uf015" block="传感器"
//% groups=['音频模块', '超声波模块', '红外测温模块', '温湿度传感器', 'others']
namespace HetaoSensor {

    //% blockId="hetao_sensor_volume" block="读取声音强度"
    //% weight=95 blockGap=8
    //% group="音频模块"
    export function volume(): number {
        pins.i2cWriteNumber(10, 0, NumberFormat.UInt8LE, true)
        let vol = pins.i2cReadNumber(10, NumberFormat.UInt8LE, false)
        return vol
    }

    //% blockId="hetao_sensor_set_volume" block="设置声音强度%vol|"
    //% weight=85 blockGap=8
    //% group="音频模块"
    export function setVolume(vol: HetaoSoundVolume) {
        let num = 0x0300
        num += vol
        pins.i2cWriteNumber(10, num, NumberFormat.UInt16BE, false)
    }

    //% blockId="hetao_sensor_play_sound" block="播放第%id|号录音"
    //% weight=65 blockGap=8
    //% group="音频模块"
    export function playSound(id: HetaoSoundIndex) {
        let num = 0x0200
        num += id
        pins.i2cWriteNumber(10, num, NumberFormat.UInt16BE, false)
    }

    //% blockId="hetao_sensor_record_sound" block="录制第%id|号录音"
    //% weight=80 blockGap=8
    //% group="音频模块"
    export function recordSound(id: HetaoSoundIndex) {
        let num = 0x0100
        num += id
        pins.i2cWriteNumber(10, num, NumberFormat.UInt16BE, false)
    }

    //% blockId="hetao_sensor_stop_record_sound" block="停止录音"
    //% weight=75 blockGap=8
    //% group="音频模块"
    export function stopRecordSound() {
        let num = 0x0100
        pins.i2cWriteNumber(10, num, NumberFormat.UInt16BE, false)
    }

    /**
     * Send a ping and get the echo time (in microseconds) as a result
     * @param trig tigger pin
     * @param echo echo pin
     * @param unit desired conversion unit
     * @param maxCmDistance maximum distance in centimeters (default is 500)
     */
    //% blockId=hetao_sonar_ping block="ping trig %trig|echo %echo|unit %unit"
    //% group="超声波模块"
    export function ping(trig: DigitalPin, echo: DigitalPin, unit: HetaoPingUnit, maxCmDistance = 500): number {
        // send pulse
        pins.setPull(trig, PinPullMode.PullNone);
        pins.digitalWritePin(trig, 0);
        control.waitMicros(2);
        pins.digitalWritePin(trig, 1);
        control.waitMicros(10);
        pins.digitalWritePin(trig, 0);

        // read pulse
        const d = pins.pulseIn(echo, PulseValue.High, maxCmDistance * 58);

        switch (unit) {
            case HetaoPingUnit.Centimeters: return Math.idiv(d, 58);
            case HetaoPingUnit.Inches: return Math.idiv(d, 148);
            default: return d;
        }
    }

    /**
     * 
     */
    let PWMInited: boolean
    let LOW: number
    let HIGH: number

    //% blockId=hetao_sensor_start_pwm block="初始化红外测温传感器"
    //% group="红外测温模块"
    export function startPWMReader() {
        let d = 0
        pins.i2cWriteNumber(16, 128 + 3, NumberFormat.Int16LE, true)
        d = pins.i2cReadNumber(16, NumberFormat.Int32LE, false)
        if (d != 0){
            MRTDorPWM = true
        }
        else{
            if (!PWMInited) {
                LOW = 0
                HIGH = 0
                PWMInited = true
                pins.onPulsed(DigitalPin.P8, PulseValue.High, () => {
                    HIGH = pins.pulseDuration()
                })
                pins.onPulsed(DigitalPin.P8, PulseValue.Low, () => {
                    LOW = pins.pulseDuration()
                })
                loops.everyInterval(500, () => {
                    serial.writeNumber(HIGH)
                    serial.writeLine(" ")
                    serial.writeNumber(LOW)
                })
            }
        }
    }

    //% blockId=hetao_sonar_temperature block="读取人体摄氏温度"
    //% group="红外测温模块"
    export function readTemperature(): number {
        if (MRTDorPWM){
            let d = 0
            let f = 0
            pins.i2cWriteNumber(16, 128 + 3, NumberFormat.Int16LE, true)
            d = pins.i2cReadNumber(16, NumberFormat.Int32LE, false)
            f = (d & 0xffff) >> 1
            f = f/10
            return f
        }
        else{
            if (!PWMInited)
                return 0
            return 280 * (HIGH / (HIGH + LOW)) - 53.4
        }
    }

    //% blockId=hetao_sonar_temperature_humidity block="读取 %attr|"
    //% group="温湿度传感器"
    export function readTemperatureAndHumiditySensor(attr: HetaoTemperatureHumidity) {
        pins.i2cWriteNumber(68, 11270, NumberFormat.UInt16BE, true)
        basic.pause(10)
        let buf = pins.i2cReadBuffer(0x44, 6)
        let temperature = buf[0] * 256 + buf[1]
        let humidity = buf[3] * 256 + buf[4]
        temperature = temperature / 65535 * 175 - 45
        humidity = humidity * 100 / 65535
        switch (attr) {
            case HetaoTemperatureHumidity.temperature:
                return temperature
            case HetaoTemperatureHumidity.humidity:
                return humidity
        }
    }
	
	//% blockId=hetao_number_keys block="读取计算键盘值"
    //% group="计算键盘"
    export function readNumberKeys(): number {
        let volume = 0
        pins.i2cWriteNumber(16, 0, NumberFormat.UInt8LE, true)
        volume = pins.i2cReadNumber(16, NumberFormat.UInt32LE, false)

        if (volume <= 0) {
            return -1
        }
        else if (volume <= 1 && volume > 0) {
            return 16
        }
        else {
            return Math.floor(Math.log(volume) / Math.log(2)) - 8
        }
    }

    //% blockId=hetao_read_knob block="读取编码开关 %n|"
    //% group="编码开关"
    export function readKnob(num: AnalogPinIN): number {
        let n = -1
        n = num
        n = pins.analogReadPin(n)

        if(n > 1000){
            return 0
        }
        else if( n >= 170 && n < 180){
            return 1
        }
        else if (n >= 250 && n < 270) {
            return 2
        }
        else if (n >= 110 && n < 125) {
            return 3
        }
        else if (n >= 500 && n < 550) {
            return 4
        }
        else if (n >= 140 && n < 155) {
            return 5
        }
        else if (n >= 190 && n < 220) {
            return 6
        }
        else if (n >= 90 && n < 110) {
            return 7
        }
        else if (n >= 600 && n < 700) {
            return 8
        }
        else if (n >= 155 && n < 170) {
            return 9
        }
        else{
            return -1
        }
    }

}
