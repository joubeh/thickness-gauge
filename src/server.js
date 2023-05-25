const express = require("express")
const app = express()
const fs = require('fs')
const expressLayouts = require('express-ejs-layouts')
const bodyParser = require('body-parser')
const { Sequelize, Op, Model, DataTypes, QueryTypes } = require("sequelize")
const axios = require('axios')


/* Config */
const SERVER_PORT = 8000
const DB_USERNAME = 'root'
const DB_PASSWORD = ''
const DB_NAME = 'micron'
const DB_HOST = '127.0.0.1'
const DB_PORT = '3306'


/* App */
let sequelize;
let Sensor, Product, Parsed, Run;
let setting = JSON.parse(fs.readFileSync('./db/setting.json').toString())
app.use(expressLayouts)
app.use(bodyParser.urlencoded({ extended: true }))
app.set('view engine', 'ejs')
app.use('/assets', express.static('assets'))

app.get('/', (req, res) => {
    res.render('index', { setting })
})

app.get('/setting', (req, res) => {
    Sensor.findAll().then(sensors => {
        res.render('setting', { setting, sensors })
    }).catch((error) => {
        res.sendStatus(500)
    });
})

app.post('/setting/update', (req, res) => {
    if(req.body.password == setting.password){
        setting.scan_time = req.body.scan_time
        setting.report_period = req.body.report_period
        setting.popup_time = req.body.popup_time
        fs.writeFileSync('./db/setting.json', JSON.stringify(setting))
    }
    res.redirect('/setting');
})

app.get('/sensor/:address', (req, res) => {
    Sensor.findOne({
        where: {
            address: parseInt(req.params.address)
        }
    }).then(sensor => {
        res.render('sensor', { layout: false, sensor:sensor, setting:setting} )
    }).catch((error) => {
        res.sendStatus(404)
    });
})

app.post('/sensors/create', (req, res) => {
    if(req.body.password == setting.password){
        Sensor.create({
            address: parseInt(req.body.address),
        }).then(sensor => {
            res.redirect('/sensor/' + req.body.address);
        }).catch((error) => {
            console.error('Failed to create a new record : ', error);
            res.redirect('/setting');
        });
    } else {
        res.redirect('/setting');
    }
})

app.post('/sensor/:address/update', (req, res) => {
    if(req.body.password == setting.password){
        Sensor.update({ 
            sampling_min: parseInt(req.body.sampling_min),
            sampling_max: parseInt(req.body.sampling_max),
            micron_ratio: req.body.micron_ratio,
            sh_period: parseInt(req.body.sh_period),
            icg_period: parseInt(req.body.icg_period),
            sg: parseInt(req.body.sg),
            average: parseInt(req.body.average)
        }, {
        where: {
            address: parseInt(req.params.address)
        }
        }).then(sensor => {
            res.redirect('/sensor/' + req.params.address);
        })
        .catch(e => {
            console.log(e);
            res.redirect('/sensor/' + req.params.address);
        })
    } else {
        res.redirect('/sensor/' + req.params.address);
    }
})

app.get('/api/sensor/:address', (req, res) => {
    Sensor.findOne({
        where: {
            address: parseInt(req.params.address)
        }
    }).then(sensor => {
        res.json(JSON.parse(sensor.data))
    }).catch((error) => {
        console.log(error);
        res.json([])
    });
})

app.get('/product/create', (req, res) => {
    Sensor.findAll().then(sensors => {
        res.render('add_product', { sensors, setting })
    }).catch((error) => {
        res.sendStatus(500)
    });
})

app.post('/product/create', (req, res) => {
    Sensor.findAll().then(sensors => {
        let sensors_config = {}
        for(let i=0; i<sensors.length; i++){
            sensors_config[sensors[i].address] = {
                min: req.body[`minscfg${sensors[i].address}`],
                max: req.body[`maxscfg${sensors[i].address}`]
            }
        }
        Product.create({
            name: req.body.name,
            sheet_type: req.body.sheet_type,
            thickness: req.body.thickness,
            color: req.body.color,
            thread_thickness: req.body.thread_thickness,
            line_speed: req.body.line_speed,
            sensors_config: JSON.stringify(sensors_config),
        }).then(sensor => {
            res.redirect('/');
        }).catch((error) => {
            res.sendStatus(500)
        });
    }).catch((error) => {
        res.sendStatus(500)
    });
})

app.get('/products', (req, res) => {
    Product.findAll().then(products => {
        res.render('products', { products, setting })
    }).catch((error) => {
        res.sendStatus(500)
    });
})

app.get('/product/:id/edit', (req, res) => {
    Product.findOne({
        where: {
            id: parseInt(req.params.id)
        }
    }).then(product => {
        Sensor.findAll().then(sensors => {
            res.render('edit_product', { product, sensors, setting })
        }).catch(e => res.sendStatus(500))        
    }).catch((error) => {
        res.sendStatus(500)
    });
})

app.post('/product/:id/update', (req, res) => {
    Sensor.findAll().then(sensors => {
        let sensors_config = {}
        for(let i=0; i<sensors.length; i++){
            sensors_config[sensors[i].address] = {
                min: req.body[`minscfg${sensors[i].address}`],
                max: req.body[`maxscfg${sensors[i].address}`]
            }
        }
        Product.update({ 
            name: req.body.name,
            sheet_type: req.body.sheet_type,
            thickness: req.body.thickness,
            color: req.body.color,
            thread_thickness: req.body.thread_thickness,
            line_speed: req.body.line_speed,
            sensors_config: JSON.stringify(sensors_config),
        }, {
        where: {
            id: parseInt(req.params.id)
        }
        }).then(sensor => {
            res.redirect('/products');
        })
        .catch(e => {
            console.log(e);
            res.redirect('/products');
        })
    }).catch(e => res.redirect('/products'))
})

app.post('/device/stop', (req, res) => {
    Run.findOne({
        order: [ [ 'id', 'DESC' ]],
    })
    .then(run => {
        Run.update({
            stopped_at: new Date()
        }, {
            where: {
                id: run.id
            }
        })
        .then(v => {})
        .catch(e => console.log(e))
    })
    .catch(e => console.log(e))
    setting.device_status = "stopped"
    fs.writeFileSync('./db/setting.json', JSON.stringify(setting))
    axios.get('http://localhost:5555/device/status-changed').catch(e => console.log(e))
    res.redirect('/')
})

app.post('/device/start', (req, res) => {
    if(Math.round((new Date().getTime() - new Date(setting.last_scan).getTime()) / 3600000) > parseInt(setting.scan_time)){
        res.render("scan_error", {setting});
        return;
    }
    Product.findAll({
        order: [ [ 'id', 'DESC' ]],
    })
    .then(products => {
        res.render('start', { products, setting })
    }).catch(e => res.sendStatus(500))
})

app.post('/device/start/product/:id', (req, res) => {
    Product.findOne({
        where: {
            id: parseInt(req.params.id)
        }
    })
    .then(product => {
        Run.create({
            product_id: product.id,
            thread_thickness: product.thread_thickness,
            line_speed: product.line_speed,
            name: product.name,
            thickness: product.thickness,
            started_at: new Date(),
            stopped_at: null,
        })
    }).catch(e => console.log(e))
    setting.device_status = "started"
    setting.current_product = req.params.id
    setting.mode = 'normal'
    fs.writeFileSync('./db/setting.json', JSON.stringify(setting))
    axios.get('http://localhost:5555/device/status-changed').catch(e => console.log(e))
    res.redirect('/')
})

app.post('/device/scan', (req, res) => {
    if(setting.device_status != "scanning")
    {
        setting.last_scan = new Date();
        setting.device_status = "scanning"
        fs.writeFileSync('./db/scan.json', JSON.stringify({status: 0}))
        fs.writeFileSync('./db/setting.json', JSON.stringify(setting))
        axios.get('http://localhost:5555/device/status-changed').catch(e => console.log(e))
        res.redirect('/device/scan/status')
    }
})

app.get('/device/scan/status', (req, res) => {
    res.render('scan_status', { layout: false });
})

app.get('/api/device/scan/status', (req, res) => {
    res.json(JSON.parse(fs.readFileSync('./db/scan.json')))
})

app.post('/device/test', (req, res) => {
    axios.get('http://localhost:5555/test-jack').catch(e => console.log(e))
})

app.get('/api/sensors/parsed', (req, res) => {
    Parsed.findOne({
        order: [ [ 'id', 'DESC' ]],
    }).then(parsed => {
        res.json(JSON.parse(parsed.data))
    }).catch(e => {
        console.log(e);
        res.sendStatus(500)
    })
})

app.get('/api/sensor/:address/scout/start', (req, res) => {
    if(setting.mode == 'scout') {return;}
    console.log(`starting scout: ${req.params.address}`);
    setting.mode = 'scout'
    setting.scout = req.params.address
    fs.writeFileSync('./db/setting.json', JSON.stringify(setting))
    axios.get('http://localhost:5555/device/status-changed').catch(e => console.log(e))
    res.send('ok')
})

app.get('/api/sensor/:address/scout/stop', (req, res) => {
    if(setting.mode != 'scout') {return;}
    console.log(`stopping scout: ${req.params.address}`);
    setting.mode = 'normal'
    fs.writeFileSync('./db/setting.json', JSON.stringify(setting))
    axios.get('http://localhost:5555/device/status-changed').catch(e => console.log(e))
    res.send('ok')
})

app.get('/api/scout', (req, res) => {
    ScoutRow.findOne().then(sr => {
        res.json(JSON.parse(sr.data))
    }).catch(e => {
        console.log(e);
        res.json({ address: -1, accepted: 0, qc: 0, barHeight: 0 })
    })
})

app.get('/app/auto-switch', (req, res) => {
    setting = JSON.parse(fs.readFileSync('./db/setting.json').toString())
    res.redirect('/')
})

app.get('/report/error-reporting', (req, res) => {
    res.render("error-reporting", { reportPeriod: parseInt(setting.report_period), setting:setting })
})

app.get('/api/report/error-reporting/:day/runs', (req, res) => {
    sequelize.query(`SELECT * FROM runs WHERE (started_at >= '${req.params.day}' AND started_at < DATE_ADD('${req.params.day}', INTERVAL 1 DAY) ) OR (stopped_at > '${req.params.day}' AND stopped_at < DATE_ADD('${req.params.day}', INTERVAL 1 DAY));`, { type: QueryTypes.SELECT })
    .then(runs => {
        res.json(runs)
    })
})

app.get('/api/report/error-reporting/:day/parsed/:time', (req, res) => {
    sequelize.query(`SELECT * FROM parseds WHERE (createdAt >= '${req.params.day} ${req.params.time}' AND createdAt < DATE_ADD('${req.params.day} ${req.params.time}', INTERVAL ${setting.report_period} MINUTE)) LIMIT 1;`, { type: QueryTypes.SELECT })
    .then(parsed => {
        res.json(parsed)
    })
})

sequelize = new Sequelize(`mysql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`)
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

sequelize.authenticate().then(() => {
    console.log('Connection has been established successfully.');
    sequelize.sync().then(() => {
        console.log('Tables synced.');
        ScoutRow.count().then(c => {
            if(c == 0){
                ScoutRow.create({
                    data: JSON.stringify({ address: -1, accepted: 0, qc: 0, barHeight: 0 })
                }).then(sr => {
                    app.listen(SERVER_PORT, () => {console.log('Server is listening on port ' + SERVER_PORT)})
                }).catch(e => console.log(e))
            } else {
                app.listen(SERVER_PORT, () => {console.log('Server is listening on port ' + SERVER_PORT)})
            }
        }).catch(e => console.log(e))
    }).catch((error) => {
        console.error('Unable to sync tables : ', error);
    });     
}).catch((error) => {
    console.error('Unable to connect to the database: ', error);
});