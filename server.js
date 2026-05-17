const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = 8000;

// Middleware configuration
app.use(cors({ origin: '*' }));
app.use(express.json()); // Built-in express parser replacing body-parser

// --- MONGODB CONNECTION ---
const mongoURI = 'mongodb://127.0.0.1:27017/emergency_system';
mongoose.connect(mongoURI)
    .then(() => console.log('🍃 MongoDB Database Connected Successfully.'))
    .catch(err => console.error('❌ MongoDB Connection Failure:', err));

// --- SCHEMAS ---
const VehicleRegistrySchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    vehicleReg: { type: String, required: true }
});
const VehicleRegistry = mongoose.model('VehicleRegistry', VehicleRegistrySchema);

const FleetStateSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    vehicleReg: { type: String, required: true },
    status: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    trafficDensity: { type: String, required: true },
    nearestHospitalAlert: { type: String, default: 'None' },
    updatedAt: { type: Date, default: Date.now }
});
const FleetState = mongoose.model('FleetState', FleetStateSchema);

const hospitalsDatabase = [
    { name: "Core Emergency Police HQ", latitude: 12.3010, longitude: 76.6420 },
    { name: "Apollo Hospital Hub", latitude: 12.2925, longitude: 76.6322 }
];

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371.0;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 1. POST: Register Vehicle
app.post('/api/register_vehicle', async (req, res) => {
    try {
        const { device_id, vehicle_reg } = req.body;
        if (!device_id || !vehicle_reg) {
            return res.status(400).json({ status: 'error', message: 'Missing fields' });
        }
        await VehicleRegistry.findOneAndUpdate(
            { deviceId: device_id.trim() },
            { vehicleReg: vehicle_reg.trim() },
            { upsert: true, new: true }
        );
        console.log(`📦 [REGISTRY] Asset Linked: ${device_id} ➡️ ${vehicle_reg}`);
        return res.status(200).json({ status: 'success', message: 'Registration Saved' });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

// 2. POST: Telemetry from Wokwi ESP32
app.post('/api/update_location', async (req, res) => {
    try {
        const { device_id, status, latitude, longitude } = req.body;

        // Print tracking in console to verify Wokwi data hitting server
        console.log(`📡 Inbound Telemetry -> ID: ${device_id} | Status: ${status} | Coords: [${latitude}, ${longitude}]`);

        const record = await VehicleRegistry.findOne({ deviceId: device_id.trim() });
        const registrationNumber = record ? record.vehicleReg : `KA-09-MA-1234`; // Fallback mock placeholder

        let trafficStatus = "✅ Flowing Normal";
        let hospitalAlert = "None";

        if (status === "Emergency") {
            trafficStatus = "🚨 Blocked (Accident Core Zone)";
            let closestStation = "Unknown Unit";
            let minDist = Infinity;

            for (const hosp of hospitalsDatabase) {
                const dist = calculateDistance(latitude, longitude, hosp.latitude, hosp.longitude);
                if (dist < minDist) {
                    minDist = dist;
                    closestStation = hosp.name;
                }
            }
            hospitalAlert = `🚨 SOS Sent to ${closestStation} (${minDist.toFixed(2)}km away)`;
            console.log(`\n🚨 [CRASH ALERT] Vehicle ${registrationNumber} CRASHED! Notifying hospital: ${closestStation} immediately.\n`);
        }

        await FleetState.findOneAndUpdate(
            { deviceId: device_id.trim() },
            {
                vehicleReg: registrationNumber,
                status: status,
                latitude: Number(latitude),
                longitude: Number(longitude),
                trafficDensity: trafficStatus,
                nearestHospitalAlert: hospitalAlert,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        return res.status(200).json({ message: 'State synced successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).send('Telemetry Logging Exception.');
    }
});

// 3. GET: UI Polling Endpoint
app.get('/api/get_state', async (req, res) => {
    try {
        const fleetItems = await FleetState.find({});
        const responseData = {};
        fleetItems.forEach(item => {
            responseData[item.deviceId] = {
                device_id: item.deviceId,
                vehicle_reg: item.vehicleReg,
                status: item.status,
                latitude: item.latitude,
                longitude: item.longitude,
                traffic_density: item.trafficDensity,
                nearest_hospital_alert: item.nearestHospitalAlert
            };
        });
        return res.json(responseData);
    } catch (err) {
        return res.status(500).json({ error: 'Database capture error.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Node.js Emergency Backend running on http://127.0.0.1:${PORT}`);
});