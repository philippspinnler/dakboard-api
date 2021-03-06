const express = require('express');
const router = express.Router();
const axios = require('axios').default;

let expiresAtTesla = null;
let refreshTokenTesla = null;
let accessTokenTesla = null;

router.get('/', async (req, res) => {
    const getToken = async () => {
        if (expiresAtTesla && Date.now() < expiresAtTesla) {
            return accessTokenTesla;
        }

        let authBody;

        if (expiresAtTesla && Date.now() >= expiresAtTesla) {
            authBody = {
                refresh_token: refreshTokenTesla,
                client_secret: process.env.MODULE_TESLA_CLIENT_SECRET,
                client_id: process.env.MODULE_TESLA_CLIENT_ID,
                grant_type: 'refresh_token'
            }
        } else {
            authBody = {
                password: process.env.MODULE_TESLA_PASSWORD,
                email: process.env.MODULE_TESLA_EMAIL,
                client_secret: process.env.MODULE_TESLA_CLIENT_SECRET,
                client_id: process.env.MODULE_TESLA_CLIENT_ID,
                grant_type: 'password'
            }
        }

        const responseToken = await axios.post('https://owner-api.teslamotors.com/oauth/token', authBody);
        expiresAtTesla = ((Date.now() / 1000) + responseToken.data.expires_in) * 1000;
        refreshTokenTesla = responseToken.data.refresh_token;
        return responseToken.data.access_token;
    }

    accessTokenTesla = await getToken();

    const responseVehicles = await axios.get('https://owner-api.teslamotors.com/api/1/vehicles', {
        headers: {
            Authorization: `Bearer ${accessTokenTesla}`
        }
    });
    const id = responseVehicles.data.response[0].id_s;

    const responseState = await axios.get(`https://owner-api.teslamotors.com/api/1/vehicles/${id}/vehicle_data`, {
        headers: {
            Authorization: `Bearer ${accessTokenTesla}`
        }
    });

    const lat = responseState.data.response.drive_state.latitude;
    const long = responseState.data.response.drive_state.longitude;

    const responseGeolocation = await axios.get(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${long}&key=${process.env.MODULE_TESLA_OPEN_CAGE_API_KEY}`);
    const road = responseGeolocation.data.results[0].components.road;
    const city = responseGeolocation.data.results[0].components.city || responseGeolocation.data.results[0].components.village;
    

    res.send({
        name: responseState.data.response.vehicle_state.vehicle_name,
        insideTemperature: responseState.data.response.climate_state.inside_temp,
        insideTemperatureFormatted: `${responseState.data.response.climate_state.inside_temp} °C`,
        batteryLevel: responseState.data.response.charge_state.battery_level,
        batteryLevelFormatted: `${responseState.data.response.charge_state.battery_level} %`,
        batteryRange: responseState.data.response.charge_state.ideal_battery_range,
        batteryRangeFormatted: `${(responseState.data.response.charge_state.ideal_battery_range * 1.60934).toFixed(0)} km`,
        gps: {
            lastUpdate: (new Date(responseState.data.response.drive_state.gps_as_of * 1000)).toISOString(),
            latitude: lat,
            longitude: long,
            address: `${road}, ${city}`
        }
    })
});

module.exports = router;