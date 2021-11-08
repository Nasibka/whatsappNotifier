require("./db");
const CAR = require("./models/cars");
const axios = require("axios");
const CronJob = require('cron').CronJob;
const Config = require('./config')
const {sellerUrl,sellerUrl2,seller,seller2} = require("./wpConfig");
const mainServiceUrl = Config.mainServiceUrl

const wpText = [
    '👋Доброго времени суток! Вы продаете ',
    'Здравствуйте, могу спросить, это вы продаете ',
    '👋Приветсвую! Это вы продаете ',
]

async function getNotSendCars(){
    //TODO experiment with limit
    const cars = await CAR.find({send:false, isWP:true,phone:{$ne:null}}).limit(20)
    console.log('Number of cars needed to send message: '+cars.length);

    for(car of cars){
        phones = car.phone.split(',')
        let url = car.id%2===0 ? sellerUrl : sellerUrl2
        let chatApi = car.id%2===0 ? 1 : 2
        
        for(phone of phones){            
            let isWP = await WPCheck(phone,chatApi)
            if(isWP===undefined){
                return
            }else if(isWP){
                await delay(1500) //TODO experiment with delay 
                
                let send
                if(Config.environment === 'production'){
                    let text = wpText[Math.floor(Math.random() * wpText.length)] + ' '+car.title+' '+ car.year +' года?'
                    send = await sendMessageWP(url,phone,text) 
                }else{
                    let text = wpText[Math.floor(Math.random() * wpText.length)] + ' '+car.title+' '+ car.year +' года?'
                    console.log(text)
                    send = true
                    // send = await sendMessageWP(url,phone,text) 
                    // send = await sendMessageWP(url,'77085170456',text) 
                }

                if(send){
                    car.isWP = true
                    car.send = true
                    await car.save()
                    console.log('sent '+phone);

                    try{
                        //request on carfast.service.main
                        let res = await axios.post(mainServiceUrl+'/createWAuser',
                        { 
                            phone: phone,
                            title: car.title,
                            id: car.id,
                            year: car.year, 
                            chatApi: chatApi
                        })
                        console.log(res.status,59)
                    }catch(err){}
                    
                    break
                }
                
            }else{
                //no wp on this phone
                console.log('no wp on this phone '+phone);
                car.isWP = false
                await car.save()
            }
        }
    }
}


async function sendMessageWP(url,phone,text){
    let res = await axios.post(url,{ phone: phone, body:text })
    if(res.data.sent){
        return true
    }else{
        return false
    }
}

async function WPCheck(phone,chatApi){
    try{
        const wp = chatApi === 1 ? seller : seller2
        const res = await axios.get(wp.url+'checkPhone'+wp.token+'&&phone='+phone)
        
        if(res.data.error ==='Status of the account not equals authenticated'){
            console.error('Status of the whataspp account not equals authenticated. Go to chat api and check this one:'+wp.token)
            return undefined
        }

        if (res.data.result == "exists"){
            return true
        }
        else{
            return false
        }     
    }catch(err){
        return false
    }


}

var job = new CronJob(Config.cron, function() {
    getNotSendCars()
});
job.start()

const delay = ms => new Promise(res => setTimeout(res, ms));