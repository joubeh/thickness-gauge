const { SerialPort } = require('serialport')

const LEDPort = new SerialPort({
    path: 'COM15',
    baudRate: 9600,
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
    // errorValuesStr += 'B'
    console.log(errorValuesStr);
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

let dddd = [
    [
        {
            1: -15,
            2: 2,
            4: 3
        }, 'NORMAL'
    ],
    [
        {
            1: -1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: -1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: -1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: -1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: -1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: -1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: -1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: -1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            2: 6
        }, 'SCOUT'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 14,
            3: 0,
            4: 14
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ],
    [
        {
            1: 1,
            2: 2,
            4: 4
        }, 'NORMAL'
    ]
]

function sendddd(idx) {
    changeLEDColor(dddd[idx][0], dddd[idx][1])
    setTimeout(() => {
        if(idx < dddd.length-1){
            sendddd(idx+1)
        }
    }, 1000)
}

sendddd(0)