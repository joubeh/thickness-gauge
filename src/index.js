/* config */
const SERVER_PORT = 5555
const DB_USERNAME = 'root'
const DB_PASSWORD = ''
const DB_NAME = 'micron'
const DB_HOST = '127.0.0.1'
const DB_PORT = '3306'
const DEVICE_PORT = 'COM11'
const DEVICE_BAUDRATE = 230400
const LED_PORT = 'COM15'
const LED_BAUDRATE = 9600
const JACK_PORT = ''
const JACK_BAUDRATE = 0



/* app */
const { SerialPort } = require('serialport')
const PubSub = require('pubsub-js')
const fs = require('fs')
const { Sequelize, Op, Model, DataTypes } = require("sequelize")
const express = require("express")
const app = express()


function convertToHex(a){
    let hexxxx = a.toString(16)
    let adddd = 8 - hexxxx.length
    for(let i=0; i<adddd; i++){
        hexxxx = '0'+hexxxx
    }
    return [
        parseInt(hexxxx[6]+hexxxx[7], 16),
        parseInt(hexxxx[4]+hexxxx[5], 16),
        parseInt(hexxxx[2]+hexxxx[3], 16),
        parseInt(hexxxx[0]+hexxxx[1], 16),
    ]
}

let Parsed, Sensor, Product, Run;
let current_run_id;
let setting
let scoutWriteTurn = true
let currentProductSC
let currentProductT


let sequelize = new Sequelize(`mysql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`)
ScoutRow = sequelize.define('scout_rows', {
    data: {
        type: DataTypes.TEXT,
        allowNull: false,
    }
})

Parsed = sequelize.define('parseds', {
    data: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    run_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
})

Sensor = sequelize.define("sensors", {
    address: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
    },
    sampling_min: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    sampling_max: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    micron_ratio: {
        type: DataTypes.STRING,
        allowNull: true
    },
    sh_period: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    icg_period: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    sg: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    average: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    data: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    zero: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
});

Product = sequelize.define('products', {
    sheet_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    thickness: {
        type: DataTypes.STRING,
        allowNull: false
    },
    color: {
        type: DataTypes.STRING,
        allowNull: false
    },
    thread_thickness: {
        type: DataTypes.STRING,
        allowNull: false
    },
    line_speed: {
        type: DataTypes.STRING,
        allowNull: false
    },
    sensors_config: {
        type: DataTypes.TEXT,
        allowNull: false
    }
})

Run = sequelize.define('runs', {
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    thread_thickness: {
        type: DataTypes.STRING,
        allowNull: false
    },
    line_speed: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    thickness: {
        type: DataTypes.STRING,
        allowNull: false
    },
    started_at: {
        type: DataTypes.DATE,
        allowNull: false
    },
    stopped_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
})


let sensors = []
let dataBank = {};

const port = new SerialPort({
  path: DEVICE_PORT,
  baudRate: DEVICE_BAUDRATE,
})

port.on('error', function(err) {
    console.log('Error: ', err.message)
})

let didDataCome = true
let didDataComeTimer = "NO_TIMER";
let dataLengthTimer = "NO_TIMER";
let current_length = 0
let cd = []
port.on('data', function (data) {
    if(didDataComeTimer != "NO_TIMER"){
        clearTimeout(didDataComeTimer)
        didDataComeTimer = "NO_TIMER"
    }
    didDataCome = true
    current_length += data.length;
    cd.push(data)
    if(current_length === 7394){

        if(dataLengthTimer != "NO_TIMER"){
            clearTimeout(dataLengthTimer)
            dataLengthTimer = "NO_TIMER"
        }

        let buff = Buffer.concat(cd)
        console.log(`Data recived from ${buff[4]}:`)
        console.log(buff)
        current_length = 0;
        cd = [];
        dataBank[buff[4]] = buff;
        if(setting.device_status == 'started')
        {
            if(setting.mode == 'normal'){
                triggerNormalMode()
            } else if(setting.mode == 'scout'){
                if(scoutWriteTurn){
                    ScoutRow.update({
                        data: JSON.stringify(parseData(buff))
                    }, {
                        where: {
                            id: 1
                        }
                    }).then(val => {
                        console.log("ScoutRow wrote");
                        scoutWriteTurn = false
                        triggerScoutMode()
                    }).catch(e => {
                        console.log("ScoutRow failed write");
                        console.log(e);
                        scoutWriteTurn = false
                        triggerScoutMode()
                    })
                } else {
                    scoutWriteTurn = true
                    triggerScoutMode()
                }
            }
        } else if(setting.device_status == 'scanning')
        {
            triggerScanMode()
        }
    } else {
        if(dataLengthTimer != "NO_TIMER"){
            clearTimeout(dataLengthTimer)
            dataLengthTimer = "NO_TIMER"
        }
        dataLengthTimer = setTimeout(() => {
            console.log(`CL: ${current_length}`);
            current_length = 0;
            cd = [];
            if(setting.device_status == 'started')
            {
                if(setting.mode == 'normal'){
                    triggerNormalMode()
                } else if(setting.mode == 'scout'){
                    scoutWriteTurn = true
                    triggerScoutMode()
                }
            }
        }, 1000)
    }
})

const LEDPort = new SerialPort({
    path: LED_PORT,
    baudRate: LED_BAUDRATE,
})

LEDPort.on('error', function(err) {
    console.log('Error: ', err.message)
})

let oldErrorValues = {};
function changeLEDColor(errorValues, mode = 'NORMAL'){
    // keep old values for other sensors 
    if(mode == 'SCOUT') {
        let scoutAddress = Object.keys(errorValues)[0];
        oldErrorValues[scoutAddress] = errorValues[scoutAddress];
        errorValues = oldErrorValues;
    }

    // find largest key
    let max = 0
    Object.keys(errorValues).forEach(k => {
        if(parseInt(k) >= max){
            max = parseInt(k)
        }
    });
    
    // send data
    let errorValuesStr = "B";
    for(let i=1; i<=max; i++){
        if(i in errorValues){
            if(errorValues[i] > 15){
                errorValuesStr += '15';
            } else if(errorValues[i] < -15){
                errorValuesStr += '-15';
            } else {
                errorValuesStr += errorValues[i]+'';
            }
        } else {
            errorValuesStr += 'C';
        }
        if(i != max){
            errorValuesStr += '*';
        }
    }
    LEDPort.write(errorValuesStr, function(err) {
        if (err) {
            return console.log('Error on write: ', err.message)
        }
    })

    // update old values
    if(mode == 'NORMAL') {
        oldErrorValues = errorValues;
    }
}

function parseData(data){
    let address = data[4]
    let accepted = 0
    let points = []
    let qc = 1
    let tmp
    let s = getSensor(address)
    const smin = s.sampling_min
    const smax = s.sampling_max

    for(let i=6; i<7394; i+=2){
        tmp = (data[i+1] << 8) + data[i]
        points.push(tmp)
        if(tmp >= smin && tmp <= smax){
            accepted++
        }
    }
    let errorValue = 0;
    let barHeight = getBarHeight(accepted, s.zero, parseFloat(s.micron_ratio))
    if(barHeight > (currentProductT + parseInt(currentProductSC[`${address}`].max))){
        qc = 2
        errorValue = barHeight - (currentProductT + parseInt(currentProductSC[`${address}`].max));
    } else if(barHeight < (currentProductT - parseInt(currentProductSC[`${address}`].min))){
        qc = 0
        errorValue = (currentProductT - parseInt(currentProductSC[`${address}`].min)) - barHeight;
    }
    changeLEDColor([errorValue], 'SCOUT');
    return {address: address, accepted: accepted, qc: qc, barHeight: barHeight}
}

function getSensor(address){
    for(let i=0; i<sensors.length; i++){
        if(sensors[i].address == parseInt(address)) return sensors[i]
    }
    console.log(`ERROR: getSensor(${address})`);
}

function getBarHeight(accepted, zero, micron_ratio){
    return ((accepted - zero)/micron_ratio)
}

function NM_processData(){
    console.log("processing");
    let minedData = []
    let tmp = 0
    let errorValues = {}

    let keys = Object.keys(dataBank)
    for(let j=0; j<keys.length; j++){
        let address = keys[j]
        let accepted = 0
        let points = []
        let qc = 1
        let s = getSensor(address)
        const smin = s.sampling_min
        const smax = s.sampling_max

        for(let i=6; i<7394; i+=2){
            tmp = (dataBank[address][i+1] << 8) + dataBank[address][i]
            points.push(tmp)
            if(tmp >= smin && tmp <= smax){
                accepted++
            }
        }

        let errorValue = 0;
        let barHeight = getBarHeight(accepted, s.zero, parseFloat(s.micron_ratio))
        if(barHeight > (currentProductT + parseInt(currentProductSC[`${address}`].max))){
            qc = 2
            errorValue = barHeight - (currentProductT + parseInt(currentProductSC[`${address}`].max));
        } else if(barHeight < (currentProductT - parseInt(currentProductSC[`${address}`].min))){
            qc = 0
            errorValue = (currentProductT - parseInt(currentProductSC[`${address}`].min)) - barHeight;
        }
        minedData.push({address: address, accepted: accepted, qc: qc, barHeight: barHeight});
        errorValues[address] = errorValue;
        (async () => await Sensor.update({
            data: JSON.stringify(points)
        }, {
            where: { address: address }
        }))();
    }

    Parsed.create({
        data: JSON.stringify(minedData),
        run_id: current_run_id
    }).then(val => {
        console.log(minedData);
        changeLEDColor(errorValues, 'NORMAL');
        if(setting.device_status == 'started')
        {
            if(setting.mode == 'normal'){
                triggerNormalMode()
            } else if(setting.mode == 'scout'){
                triggerScoutMode()
            }
        }
    })
}

function sendRequest(sensor){
    let a = [0xAB, 0xAB, 0x0A, 0x00, sensor.address, 0x00, sensor.sh_period[0], sensor.sh_period[1], sensor.sh_period[2], sensor.sh_period[3], sensor.icg_period[0], sensor.icg_period[1], sensor.icg_period[2], sensor.icg_period[3], sensor.sg, sensor.average]
    const cs = a[0]^a[1]^a[2]^a[3]^a[4]^a[5]^a[6]^a[7]^a[8]^a[9]^a[10]^a[11]^a[12]^a[13]^a[14]^a[15]     
    let req = Buffer.from([0xAB, 0xAB, 0x0A, 0x00, sensor.address, cs, sensor.sh_period[0], sensor.sh_period[1], sensor.sh_period[2], sensor.sh_period[3], sensor.icg_period[0], sensor.icg_period[1], sensor.icg_period[2], sensor.icg_period[3], sensor.sg, sensor.average]);
    console.log(`Requesting: ${sensor.address} with:`);
    console.log(req);
    port.write(req, function(err) {
        if (err) {
            return console.log('Error on write: ', err.message)
        }
    })
    didDataCome = false
    didDataComeTimer = setTimeout(() => {
        if(!didDataCome){
            sendRequest(sensor)
        }
    }, 1000)
}

let NM_current_sensor_idx = 0;
function triggerNormalMode(){
    if(NM_current_sensor_idx === sensors.length){
        NM_current_sensor_idx = 0;
        return NM_processData()
    }
    sendRequest(sensors[NM_current_sensor_idx])
    NM_current_sensor_idx++;
}


let scoutSensor
let scoutTurn = true
function triggerScoutMode(){
    if(scoutTurn){
        console.log("SCOUT");
        sendRequest(scoutSensor)
        scoutTurn = false
    } else {
        console.log("NORMAL");
        triggerNormalMode()
        scoutTurn = true
    }
}


let SCANM_current_sensor_idx = 0;
function triggerScanMode(){
    if(SCANM_current_sensor_idx === sensors.length){
        SCANM_current_sensor_idx = 0;
        // process
        let tmp = 0
        let keys = Object.keys(dataBank)
        for(let j=0; j<keys.length; j++){
            let address = keys[j]
            let accepted = 0
            let s = getSensor(address)
            const smin = s.sampling_min
            const smax = s.sampling_max

            for(let i=6; i<7394; i+=2){
                tmp = (dataBank[address][i+1] << 8) + dataBank[address][i]
                if(tmp >= smin && tmp <= smax){
                    accepted++
                }
            }

            (async () => await Sensor.update({
                zero: accepted
            }, {
                where: { address: address }
            }))();
        }

        sequelize.query("SELECT 1+1 AS result")
        .then(ig => {
            // todo: jack switch
            // done and back to stop
            setting.device_status = 'stopped'
            fs.writeFileSync('./db/setting.json', JSON.stringify(setting))
            fs.writeFileSync('./db/scan.json', JSON.stringify({status: 1}))
            autoSwitchDevice()
        })
    } else {
        sendRequest(sensors[SCANM_current_sensor_idx])
        SCANM_current_sensor_idx++;
    }
}

function autoSwitchDevice() {
    setting = JSON.parse(fs.readFileSync('./db/setting.json'))
    if(setting.device_status == 'stopped') {

    } else if(setting.device_status == 'started'){
        Run.findOne({
            order: [ [ 'id', 'DESC' ]],
        })
        .then(run => {
            current_run_id = run.id
            NM_current_sensor_idx = 0
            Sensor.findAll()
            .then(ss => {
                sensors = []
                ss.forEach(s => {
                    sensors.push({
                        id: s.id,
                        address: s.address,
                        sampling_min: s.sampling_min,
                        sampling_max: s.sampling_max,
                        micron_ratio: s.micron_ratio,
                        sh_period: convertToHex(s.sh_period),
                        icg_period: convertToHex(s.icg_period),
                        sg: s.sg,
                        average: s.average,
                        zero: s.zero
                    })
                });
                Product.findOne({
                    where: {
                        id: parseInt(setting.current_product)
                    }
                }).then(p => {
                    currentProductSC = JSON.parse(p.sensors_config)
                    currentProductT = parseInt(p.thickness)
                    if(setting.mode == "normal"){
                        triggerNormalMode()
                    } else if(setting.mode == "scout"){
                        Sensor.findOne({
                            where: {
                                address: parseInt(setting.scout)
                            }
                        }).then(s => {
                            scoutSensor = {
                                id: s.id,
                                address: s.address,
                                sampling_min: s.sampling_min,
                                sampling_max: s.sampling_max,
                                micron_ratio: s.micron_ratio,
                                sh_period: convertToHex(s.sh_period),
                                icg_period: convertToHex(s.icg_period),
                                sg: s.sg,
                                average: s.average,
                                zero: s.zero
                            }
                            scoutTurn = true
                            triggerScoutMode()
                        }).catch(e => console.log(e))
                    }
                }).catch(e => console.log(e))
            }).catch(e => {
                console.log(e)
            })
        }).catch(e => console.log(e))
    } else if(setting.device_status == 'scanning'){
        // todo: jack switch
        // scan zeros
        Sensor.findAll()
        .then(ss => {
            sensors = []
            ss.forEach(s => {
                sensors.push({
                    id: s.id,
                    address: s.address,
                    sampling_min: s.sampling_min,
                    sampling_max: s.sampling_max,
                    micron_ratio: s.micron_ratio,
                    sh_period: convertToHex(s.sh_period),
                    icg_period: convertToHex(s.icg_period),
                    sg: s.sg,
                    average: s.average,
                    zero: s.zero
                })
            });
            SCANM_current_sensor_idx = 0
            triggerScanMode()
        }).catch(e => {
            console.log(e)
        })
    }
}

app.get('/device/status-changed', (req, res) => {
    console.log("Device status changed");
    autoSwitchDevice()
    res.send('ok')
})

app.get('/test-jack', (req, res) => {
    // todo: jack switch
    res.send('ok')
})

sequelize.authenticate().then(() => {
    console.log('Connection has been established successfully.');
    sequelize.sync().then(() => {
        console.log('Tables synced.');
        autoSwitchDevice()
        app.listen(SERVER_PORT, () => console.log("server is running on port "+SERVER_PORT))
    }).catch((error) => {
        console.error('Unable to sync tables : ', error);
    });     
}).catch((error) => {
    console.error('Unable to connect to the database: ', error);
});
