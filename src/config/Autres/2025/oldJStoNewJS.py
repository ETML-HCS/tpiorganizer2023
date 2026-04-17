import json
from datetime import datetime

def transform_data(old_data):
    # Define a function to parse date strings and handle invalid formats
    def parse_date(date_string, default_date):
        try:
            return datetime.strptime(date_string, "%d.%m.%y").isoformat()
        except ValueError:
            return default_date

    return {
        "refTpi": old_data.get("refTpi", ""),
        "candidat": old_data.get("candidat", ""),
        "experts": {
            "1": old_data.get("expert1", ""),
            "2": old_data.get("expert2", "")
        },
        "boss": old_data.get("boss", ""),
        "lieu": {
            "entreprise": old_data.get("lieu-entreprise", ""),
            "site": old_data.get("lieu-site", "")
        },
        "sujet": old_data.get("sujet", ""),
        "description": old_data.get("remarque(s)", ""),
        "tags": old_data.get("tags", "").split(" / "),  # Convert the string to a list
        "dates": {
            "depart": parse_date(old_data.get("dateDepart"), ""),
            "fin": parse_date(old_data.get("dateFin"), "")
        },
        "salle": old_data.get("salle", "")
    }

# Load the old data from the input JSON file
with open("tpiList_2025.json", "r", encoding="utf-8") as input_file:
    old_data = json.load(input_file)

# Transform the old data to the new data structure
new_data = [transform_data(item) for item in old_data]

# Save the new data to the output JSON file
with open("new_tpiList_2025.json", "w") as output_file:
    json.dump(new_data, output_file)
