import json
import requests
import io
import re
import logging
import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Eco-Assistant API")

# 1. ALLOW FRONTEND CONNECTION (Updated for security)
# Change ["*"] to your specific domain when deploying
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. DATABASE HELPER (With Global Caching)
_DB_CACHE = None

def load_db():
    global _DB_CACHE
    if _DB_CACHE is not None:
        return _DB_CACHE
    try:
        with open("chemicals.json", "r") as file:
            _DB_CACHE = json.load(file)
            return _DB_CACHE
    except (FileNotFoundError, json.JSONDecodeError):
        logger.error("Database file missing or corrupted.")
        return {}

# 3. WIKIPEDIA HELPER (Improved with Regex for accuracy)
def get_wikipedia_summary(query: str):
    # Regex to remove filler phrases only if they are whole words at the start
    fillers = r"^(explain about|tell me about|what is a|what is|define|explain|about)\s+"
    clean_query = re.sub(fillers, "", query.lower()).strip().capitalize()
    
    if not clean_query:
        return None

    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{clean_query.replace(' ', '_')}"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return response.json().get("extract", "")
    except requests.exceptions.RequestException as e:
        logger.warning(f"Wikipedia API error: {e}")
    return None

# 4. ANALYZE/COMPARE ROUTE
@app.get("/compare/{chemical_name}")
async def compare_chemical(chemical_name: str):
    db = load_db()
    name_lower = chemical_name.lower().strip()
    
    # Check Local JSON
    if name_lower in db:
        target = db[name_lower]
        alternative = next((c for c in db.values() if c.get("is_green")), None)
        return {"found": True, "source": "local", "target": target, "alternative": alternative}
    
    # Check Global PubChem
    try:
        pub_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name_lower}/property/Title,Complexity/JSON"
        res = requests.get(pub_url, timeout=5)
        res.raise_for_status()
        data = res.json()
        
        if "PropertyTable" in data:
            prop = data["PropertyTable"]["Properties"][0]
            cid = prop["CID"]
            global_target = {
                "name": prop["Title"], 
                "is_green": False, 
                "score": 3,
                "reason": f"Global record found (CID: {cid}). Not verified in our Green Library.",
                "native_use": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}"
            }
            alternative = next((c for c in db.values() if c.get("is_green")), None)
            return {"found": True, "source": "global", "target": global_target, "alternative": alternative}
    except Exception as e:
        logger.error(f"PubChem Error: {e}")

    return {"found": False, "message": "Chemical not found."}

# 5. CHATBOT ROUTE
@app.post("/chat")
async def chat_assistant(data: dict):
    user_msg = data.get("message", "").lower().strip()
    if not user_msg:
        return {"reply": "Please say something!"}
        
    db = load_db()

    # Knowledge Base
    knowledge = {
        "principles": "Green Chemistry has 12 principles, including atom economy and waste prevention.",
        "hello": "Hello! I am your Eco-Assistant. How can I help with your chemistry research?",
        "hi": "Hi there! Ready to explore some green chemistry?",
    }
    
    for key, response in knowledge.items():
        if key in user_msg:
            return {"reply": response}

    # Local DB Check
    for key, chem in db.items():
        if key in user_msg:
            status = "green" if chem["is_green"] else "non-green"
            return {"reply": f"From the library: {chem['name']} is {status} because {chem['reason']}."}

    # Wikipedia Fallback
    wiki_res = get_wikipedia_summary(user_msg)
    if wiki_res:
        return {"reply": wiki_res}

    return {"reply": "I'm not sure about that. Try asking about a specific chemical or 'Green Chemistry principles'."}

# 6. BATCH FILE UPLOAD
@app.post("/upload")
async def upload_chemicals(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")
        
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        db = load_db()
        
        results = []
        for name in df.iloc[:, 0]:
            name_str = str(name).strip().lower()
            is_green = db.get(name_str, {}).get("is_green", False)
            results.append({"name": str(name), "is_green": is_green})
        
        return {"filename": file.filename, "total_count": len(results), "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 7. ANALYZE REACTION (Advanced Heuristics)
# Update your /analyze-reaction route in main.py
@app.post("/analyze-reaction")
async def analyze_reaction(data: dict):
    reactants = [r.lower().strip() for r in data.get("reactants", []) if r]
    db = load_db()
    
    # 1. Gather Data
    hazards = []
    is_complex = False
    all_green = True
    
    for r in reactants:
        if r in db:
            if not db[r]["is_green"]:
                hazards.append(db[r]["name"])
                all_green = False
        # Simple heuristic for "Atom Economy" or "Waste" based on complexity
        # In a real app, you'd calculate molecular weights here
    
    # 2. Map to 12 Principles
    # We define the status for all 12 principles
   # A more "honest" scientific check
    principles_status = [
    {"id": 1, "name": "Prevention", "status": len(hazards) == 0},
    {"id": 2, "name": "Atom Economy", "status": len(reactants) < 2}, # High bar: Only additions/rearrangements
    {"id": 3, "name": "Less Hazardous Synthesis", "status": len(hazards) == 0},
    {"id": 4, "name": "Designing Safer Chemicals", "status": all_green and not is_complex},
    {"id": 5, "name": "Safer Solvents & Auxiliaries", "status": "water" in reactants}, # Only green if water is used
    {"id": 6, "name": "Design for Energy Efficiency", "status": False}, # Combustion/Heating usually fails this
    {"id": 7, "name": "Use of Renewable Feedstocks", "status": any(x in reactants for x in ["ethanol", "cellulose", "biogas"])},
    {"id": 8, "name": "Reduce Derivatives", "status": True}, 
    {"id": 9, "name": "Catalysis", "status": "catalyst" in str(reactants)},
    {"id": 10, "name": "Design for Degradation", "status": any(x in reactants for x in ["biodegradable", "sugar"])},
    {"id": 11, "name": "Real-time Analysis", "status": False}, # Requires specific sensor equipment
    {"id": 12, "name": "Inherently Safer Chemistry", "status": "oxygen" not in reactants and len(hazards) == 0} # Oxygen + Fuel = Explosion risk!
    ]

    return {
        "is_green": len(hazards) == 0,
        "warning": f"Hazards: {', '.join(hazards)}" if hazards else "Clean pathway!",
        "principles": principles_status, # NEW DATA FIELD
        "alternative_suggestion": "Try bio-based solvents" if hazards else None
    }

# 8. LIBRARY LIST
@app.get("/list")
async def get_all_chemicals():
    db = load_db()
    return [{"name": data["name"], "is_green": data.get("is_green", False)} for data in db.values()]

@app.get("/molecule-info/{name}")
async def get_molecule_details(name: str):
    try:
        # 1. Get CID first
        cid_res = requests.get(f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{name}/cids/JSON", timeout=5)
        cid_res.raise_for_status()
        cid = cid_res.json()["IdentifierList"]["CID"][0]

        # 2. Get Properties
        props_url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/property/MolecularWeight,MolecularFormula,XLogP,Complexity,Charge,ExactMass/JSON"
        props_res = requests.get(props_url, timeout=5).json()
        
        # 3. Get Solubility/Density from Experimental Properties (Simplified)
        # Note: Detailed solubility often requires a different PubChem section, 
        # but we can return the core chemical metadata here.
        
        properties = props_res["PropertyTable"]["Properties"][0]
        
        return {
            "found": True,
            "cid": cid,
            "image_2d": f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/PNG",
            "properties": properties,
            "pubchem_link": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}"
        }
    except Exception as e:
        return {"found": False, "error": str(e)}