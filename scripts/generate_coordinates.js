"use strict";

let NodeGeocoder = require('node-geocoder');
let Location = require("../models/location");


let options = {
    provider: 'mapquest',
    apiKey: '4G7Nj8M57B9OAe0P4tKvXymqFGS6lVZb',
};
   
let geocoder = NodeGeocoder(options);

async function getLocationCoordinates() {
    let locations = await Location.select("name").get();
    locations = locations.toJSON();
    let coords = [];

    for (let location of locations) {
        let res = await geocoder.geocode(location.name);

        for(let i = 0; i < res.length; i++){
            if(res[i].countryCode === "SI" && res[i].formattedAddress.includes(location.name)){
                let latitude = res[i].latitude || null;
                let longitude = res[i].longitude || null;

                coords.push([longitude, latitude]);
            }
        }
    }
    console.log(coords);
    console.log(coords.length);
    console.log("Done");
}

getLocationCoordinates();


