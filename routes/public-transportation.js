const express = require('express');
const router = express.Router();
const axios = require('axios').default;

const departures = {};

router.get('/', async (req, res) => {
    const connections = JSON.parse(req.query.connections);

    const result = [];
    try {
        for (const connection of connections) {
            const connectionName = `${ connection[0]} -> ${ connection[1] }`;
            
            if (departures[connectionName]) {
                const departureDate = new Date(departures[connectionName].departure);
                if (departureDate > new Date()) {
                    result.push(departures[connectionName]);
                    continue;
                }
            }

            const response = await axios.get(`https://timetable.search.ch/api/route.json?num=1&from=${connection[0]}&to=${connection[1]}`);
            const departure = new Date(response.data.connections[0].departure);

            departures[connectionName] = {
                connection: connectionName,
                departure: `${departure.toISOString()}`,
                departureHHMM: `${departure.getHours()}:${departure.getMinutes()}`,
                departureFormatted: `${departure.getHours()}:${(departure.getMinutes() < 10 ? '0' : '') + departure.getMinutes()} Uhr`
            };

            result.push(
                departures[connectionName]
            );
        }
        
        res.send({connections: result});
    } catch (e) {
        res.status(404).send({
            "error": `no route found (${e})`
        })
    }
});

module.exports = router;