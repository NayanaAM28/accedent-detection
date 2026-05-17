from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math

app = FastAPI()

# Complete, explicit CORS allowance settings to fix the pre-flight checks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Fleet Directory Store - Links Hardware IDs to Plates
vehicles_registry = {
    "VVCE-09": "KA-09-MA-1234"
}

# Live Active Fleet Telemetry Datastore Matrix
fleet_states = {}

# Pre-Configured Safe Emergency Stations
hospitals_database = [
    {"name": "Core Emergency Police HQ", "latitude": 12.3010, "longitude": 76.6420},
    {"name": "Apollo Hospital Hub", "latitude": 12.2925, "longitude": 76.6322}
]

class VehiclePayload(BaseModel):
    device_id: str
    status: str
    latitude: float
    longitude: float

def calculate_distance(lat1, lon1, lat2, lon2):
    """Computes straight line geographic separation metrics in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@app.post("/api/register_vehicle")
async def register_vehicle(payload: dict):
    """Directly accepts a loose dictionary to bypass strict typing format rejections."""
    global vehicles_registry
    device_id = payload.get("device_id")
    vehicle_reg = payload.get("vehicle_reg")
    
    if device_id and vehicle_reg:
        vehicles_registry[str(device_id).strip()] = str(vehicle_reg).strip()
        print(f"📦 [REGISTRY SUCCESS] Mapped hardware node '{device_id}' to License Plate '{vehicle_reg}'")
        return {"status": "success", "message": "Vehicle associated successfully"}
    
    return {"status": "error", "message": "Missing device_id or vehicle_reg"}

@app.post("/api/update_location")
async def update_location(data: VehiclePayload):
    global fleet_states
    reg_no = vehicles_registry.get(data.device_id, f"UNREGISTERED ({data.device_id})")
    
    traffic_status = "✅ Flowing Normal"
    hospital_alert = "None"
    
    if data.status == "Emergency":
        traffic_status = "🚨 High Traffic/Blocked (Accident Core Zone)"
        
        # Calculate nearest hospital unit location
        closest_station = "Unknown Station"
        min_dist = float('inf')
        for hosp in hospitals_database:
            dist = calculate_distance(data.latitude, data.longitude, hosp["latitude"], hosp["longitude"])
            if dist < min_dist:
                min_dist = dist
                closest_station = hosp["name"]
        
        hospital_alert = f"SOS Flag Sent to {closest_station} ({min_dist:.2f}km away)"
        print(f"\n🚨 [CRASH DETECTION] Vehicle {reg_no} crashed! Alert context pushed to {closest_station}.")

    # Maintain status logs in the fleet map object tracking storage area
    fleet_states[data.device_id] = {
        "device_id": data.device_id,
        "vehicle_reg": reg_no,
        "status": data.status,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "traffic_density": traffic_status,
        "nearest_hospital_alert": hospital_alert
    }
    return {"message": "State synchronized successfully"}

@app.get("/api/get_state")
async def get_state():
    return fleet_states

@app.post("/api/add_hospital")
async def add_hospital(hosp: dict):
    hospitals_database.append({
        "name": hosp["name"],
        "latitude": float(hosp["latitude"]),
        "longitude": float(hosp["longitude"])
    })
    return {"message": "Infrastructure Saved"}

if __name__ == "__main__":
    import uvicorn
    import nest_asyncio
    nest_asyncio.apply() 
    uvicorn.run(app, host="0.0.0.0", port=8000)