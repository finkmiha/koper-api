"use strict";

let NodeGeocoder = require('node-geocoder');
let Location = require("../models/location");


let options = {
    provider: 'mapquest',
    apiKey: '4G7Nj8M57B9OAe0P4tKvXymqFGS6lVZb',
};
   
let geocoder = NodeGeocoder(options);

async function getLocationCoordinates() {
    let locations = await Location.select(["id","name"]).get();
    locations = locations.toJSON();
    let coords = [];

    for (let [i, location] of locations.entries()) {
        let res = await geocoder.geocode(location.name);

        let geoLoopMatch = false
        for(let i = 0; i < res.length; i++){
            if(res[i].countryCode === "SI" && res[i].formattedAddress.includes(location.name)){
                let latitude = res[i].latitude;
                let longitude = res[i].longitude;
                coords.push([longitude, latitude]);
                geoLoopMatch = true
            }
        } if(geoLoopMatch === false){
            let latitude = null;
            let longitude = null;
            coords.push([longitude, latitude]);
        }

        //Insert into DB
        console.log(location.id +" "+ location.name + " coordinates are = " + coords[i])
        //await Location.update({lat: latitude, lng: longitude }).where("id",location.id);
        //Insert into DB end
    }
}
    


getLocationCoordinates();
