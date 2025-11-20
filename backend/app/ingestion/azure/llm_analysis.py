# app/ingestion/azure/llm_analysis.py

import json
import logging
from typing import Optional, List, Dict, Any
import sys
import os

# Set up basic logging configuration
logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(message)s')

# Assuming app.core.genai and app.ingestion.azure.llm_json_extractor are available
# Ensure this path manipulation is correct for your environment structure
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
from app.core.genai import llm_call
from app.ingestion.azure.llm_json_extractor import extract_json_str
# from app.ingestion.azure.llm_json_extractor import extract_json_str # Assuming this is the correct import

# --- Utility Functions ---

def _extrapolate_costs(billed_cost: float, duration_days: int) -> Dict[str, float]:
    """Helper to calculate monthly/annual forecasts."""
    if duration_days == 0:
        return {"monthly": 0.0, "annually": 0.0}
        
    avg_daily_cost = billed_cost / duration_days
    print(f"Avg daily cost calculated: {avg_daily_cost}")
    # Use 30.4375 for average days in a month (365.25 / 12)
    monthly = avg_daily_cost * 30.4375 
    annually = avg_daily_cost * 365 
    print(f"Extrapolated monthly: {monthly}, annually: {annually}")
    return {
        "monthly": round(monthly, 2),
        "annually": round(annually, 2)
    }

def _format_metrics_for_llm(resource_data: dict) -> Dict[str, Any]:
    """
    Groups and formats all metric data (AVG, MAX, MaxDate) present in the resource_data
    into a cleaner dictionary structure for the LLM to easily ingest.
    """
    formatted_metrics = {}
    
    # Identify unique metric names (e.g., "UsedCapacity (GiB)" from "metric_UsedCapacity (GiB)_Avg")
    unique_metric_names = set(
        k.replace("metric_", "").rsplit('_', 1)[0]
        for k in resource_data.keys() 
        if k.startswith("metric_") and len(k.split('_')) > 2
    )
    
    for metric_name in unique_metric_names:
        # Reconstruct the full keys
        avg_key = f"metric_{metric_name}_Avg"
        max_key = f"metric_{metric_name}_Max"
        date_key = f"metric_{metric_name}_MaxDate"
        
        # Build the structured entry for the LLM
        entry = {
            "Avg": resource_data.get(avg_key),
            "Max": resource_data.get(max_key),
            "MaxDate": resource_data.get(date_key)
        }
        
        # Only include if at least one value is present and not None
        if any(v is not None for v in entry.values()):
            formatted_metrics[metric_name] = entry
            
    return formatted_metrics

# --- PROMPT GENERATION FUNCTIONS (Updated for dynamic metric inclusion) ---

def _generate_storage_prompt(resource_data: dict, start_date: str, end_date: str, monthly_forecast: float, annual_forecast: float) -> str:
    """Generates the structured prompt for Storage LLM analysis with dynamically included metrics."""
    
    # Prepare the structured metrics for the prompt
    formatted_metrics = _format_metrics_for_llm(resource_data)

    # Use f-string for better readability and variable injection
    return f"""
  You are an Azure FinOps & Cost Optimization Expert focused on Storage.  
  Analyze the following Storage Account data and the provided metrics. Produce **ONLY** a valid JSON object according to the schema provided below.  
  Do not output any natural language commentary outside the JSON. Do not include markdown or code fencing.

  ANALYSIS CONTEXT:
  - Resource ID: {resource_data.get("resource_id", "N/A")}
  - SKU/Tier: {resource_data.get("sku", "N/A")} ({resource_data.get("access_tier", "N/A")})
  - Analysis Period: {start_date} to {end_date} ({resource_data.get("duration_days", 30)} days)
  - Total Billed Cost for Period: ${resource_data.get("billed_cost", 0.0):.2f}

  STRUCTURED UTILIZATION METRICS (Analyze this JSON structure):
  {json.dumps(formatted_metrics, indent=2)}

  INSTRUCTIONS FOR ANALYSIS:
  1. **Primary Recommendation & Savings:** Define the 'effective_recommendation' text with high detail. Based on your recommendation, **CALCULATE A REALISTIC 'saving_pct'** (0–100 range) proportional to the 'billed_cost'. This is the primary saving value.
  2. **Recommendation Basis (Metrics):** Analyze the **STRUCTURED UTILIZATION METRICS** and populate 'base_of_recommendations' with **ALL** relevant metric names (e.g., ["UsedCapacity (GiB): 'value", "Transactions (count) 'value"]) with it's values that justify the optimization decision. The most critical metric MUST be the first entry.
  3. **Tiering Logic:** If the 'access_tier' is Hot, evaluate whether the 'UsedCapacity (GiB)' Avg indicates a large static block. If so, recommend moving data to Cool/Archive. Estimate saving_pct based on typical ratios (Cool ≈ 30% cost of Hot, Archive ≈ 5% of Hot).
  4. **Anomalies:** Review the full set of metrics and identify **2 to 3** significant spikes, drops, or unusual metric values. Populate the 'anomalies' array with these events, using the MaxDate as the timestamp.
  5. **Cost Forecasting:** Perfectly follow the pre-calculated values: monthly = {monthly_forecast:.2f}, annually = {annual_forecast:.2f}.
  6. **Contract Evaluation:** Compare contracted_unit_price ({resource_data.get('contracted_unit_price', 'N/A')}) vs general SKU {resource_data.get("sku", "N/A")}. Return assessment as: "good", "bad", or "unknown".
  7. Output MUST strictly follow the schema below.

  STRICT JSON OUTPUT SCHEMA (do not modify keys, types, or structure):

  {{
    "recommendations": {{
      "effective_recommendation": {{ "text": "...", "saving_pct": 12.3 }},
      "additional_recommendation": [
        {{"text": "...", "saving_pct": 3.4}},
        {{"text": "...", "saving_pct": 5.0}}
      ],
      "base_of_recommendations": ["UsedCapacity (GiB) 'value", "Transactions (count) ' value"]
    }},
    "cost_forecasting": {{
      "monthly": {monthly_forecast:.2f},
      "annually": {annual_forecast:.2f}
    }},
    "anomalies": [
      {{
        "metric_name": "...",
        "timestamp": "YYYY-MM-DD",
        "value": 123.45,
        "reason_short": "..."
      }}
    ],
    "contract_deal": {{
      "assessment": "good" | "bad" | "unknown",
      "for sku": "{resource_data.get("sku", "N/A")}",
      "reason": "...",
      "monthly_saving_pct": 1.2,
      "annual_saving_pct": 14.4
    }}
  }}
    """

def _generate_compute_prompt(resource_data: dict, start_date: str, end_date: str, monthly_forecast: float, annual_forecast: float) -> str:
    """Generates the structured prompt for Compute/VM LLM analysis with dynamically included metrics."""

    # Prepare the structured metrics for the prompt
    formatted_metrics = _format_metrics_for_llm(resource_data)

    return f"""
   You are an Azure FinOps & VM Optimization Expert.  
      Analyze the following Virtual Machine data and metrics. Produce **ONLY** a valid JSON object based strictly on the schema shown below.  
      Never output text outside JSON. Never use markdown.

      ANALYSIS CONTEXT:
      - Resource ID: {resource_data.get("resource_id", "N/A")}
      - VM Name: {resource_data.get("resource_name", "N/A")}
      - Analysis Period: {start_date} to {end_date} ({resource_data.get("duration_days", 30)} days)
      - Total Billed Cost: ${resource_data.get("billed_cost", 0.0):.2f}

      STRUCTURED UTILIZATION METRICS (Analyze this JSON structure):
      {json.dumps(formatted_metrics, indent=2)}

      INSTRUCTIONS:
      1. **Primary Recommendation & Savings:** Define the 'effective_recommendation' text with high detail. Based on your rightsizing or optimization recommendation, **CALCULATE A REALISTIC 'saving_pct'** (0–100 range) proportional to the 'billed_cost'. This is the primary saving value.
      2. **Recommendation Basis (Metrics):** Analyze the **STRUCTURED UTILIZATION METRICS** and populate 'base_of_recommendations' with **ALL** relevant metric names (e.g., ["Percentage CPU :' with value'", "Available Memory Bytes :'with value'", "Network In :'value'"]) with it's values that justify the optimization decision. The most critical metric MUST be the first entry.
      3. **Rightsizing Logic:** Recommend downsizing when: 'Percentage CPU' Avg is < 20 AND Max is < 75. If CPU_Max > 90, include a high-risk note (avoid rightsizing) and focus on the anomaly.
      4. **Anomalies:** Review the full set of metrics and identify **2 to 3** significant spikes, drops, or unusual metric values. Populate the 'anomalies' array with these events, using the MaxDate as the timestamp.
      5. **Cost Forecasting:** Must use the pre-calculated values: monthly = {monthly_forecast:.2f}, annually = {annual_forecast:.2f}.
      6. **Contract Evaluation:** Compare contracted_unit_price ({resource_data.get('contracted_unit_price', 'N/A')}) vs general instance_type {resource_data.get("instance_type", "N/A")}. Return assessment as: "good", "bad", or "unknown".
      7. Use EXACT schema below. Do NOT change any field names or structure.

      STRICT JSON OUTPUT SCHEMA:
    
      {{
        "recommendations": {{
          "effective_recommendation": {{ "text": "...", "saving_pct": 12.3 }},
          "additional_recommendation": [
            {{"text": "...", "saving_pct": 3.4}},
            {{"text": "...", "saving_pct": 5.0}}
          ],
          "base_of_recommendations": ["Percentage CPU : 'value'", "Available Memory :'value'"]
        }},
        "cost_forecasting": {{
          "monthly": {monthly_forecast:.2f},
          "annually": {annual_forecast:.2f}
        }},
        "anomalies": [
          {{
            "metric_name": "...",
            "timestamp": "YYYY-MM-DD HH24:MI",
            "value": 123.45,
            "reason_short": "..."
          }}
        ],
        "contract_deal": {{
          "assessment": "good" | "bad" | "unknown",
          "for sku": "{resource_data.get("instance_type", "N/A")}",
          "reason": "...",
          "monthly_saving_pct": 1.2,
          "annual_saving_pct": 14.4
        }}
      }}
    """

# --- EXPORTED LLM CALL FUNCTIONS (with logging) ---

def get_storage_recommendation_single(resource_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Generates cost recommendations for a single Azure Storage Account.
    """
    if not resource_data:
        logging.warning("Received empty resource_data for storage.")
        return None

    billed_cost = resource_data.get("billed_cost", 0.0)
    duration_days = int(resource_data.get("duration_days", 30) or 30)
    start_date = resource_data.get("start_date", "N/A")
    end_date = resource_data.get("end_date", "N/A")
    resource_id = resource_data.get('resource_id', 'Unknown')
    
    forecast = _extrapolate_costs(billed_cost, duration_days)
    prompt = _generate_storage_prompt(resource_data, start_date, end_date, forecast['monthly'], forecast['annually'])
    
    raw = llm_call(prompt)
    if not raw:
        logging.error(f"Empty LLM response for storage resource {resource_id}")
        return None

    # NOTE: Assuming extract_json_str is available and correctly imported
    json_str = extract_json_str(raw)
    if not json_str:
        logging.error(f"Could not extract JSON from LLM output for storage resource {resource_id}. Raw output:\n{raw[:200]}...")
        return None

    try:
        parsed = json.loads(json_str)
        if not isinstance(parsed, dict):
            logging.error(f"LLM storage response parsed to non-dict: {type(parsed)} for {resource_id}")
            return None
    except json.JSONDecodeError:
        logging.error(f"Error decoding JSON (after extraction) for storage resource {resource_id}. Extracted string:\n{json_str[:200]}...")
        return None

    parsed['resource_id'] = resource_id
    parsed['_forecast_monthly'] = forecast['monthly']
    parsed['_forecast_annual'] = forecast['annually']
    return parsed


def get_compute_recommendation_single(resource_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Generates cost recommendations for a single VM resource.
    """
    if not resource_data:
        logging.warning("Received empty resource_data for compute.")
        return None

    billed_cost = resource_data.get("billed_cost", 0.0)
    duration_days = int(resource_data.get("duration_days", 30) or 30)
    start_date = resource_data.get("start_date", "N/A")
    end_date = resource_data.get("end_date", "N/A")
    resource_id = resource_data.get('resource_id', 'Unknown')

    forecast = _extrapolate_costs(billed_cost, duration_days)
    prompt = _generate_compute_prompt(resource_data, start_date, end_date, forecast['monthly'], forecast['annually'])
    
    raw = llm_call(prompt)
    if not raw:
        logging.error(f"Empty LLM response for compute resource {resource_id}")
        return None

    # NOTE: Assuming extract_json_str is available and correctly imported
    json_str = extract_json_str(raw)
    if not json_str:
        logging.error(f"Could not extract JSON from LLM output for compute resource {resource_id}. Raw output:\n{raw[:200]}...")
        return None

    try:
        parsed = json.loads(json_str)
        if not isinstance(parsed, dict):
            logging.error(f"LLM compute response parsed to non-dict: {type(parsed)} for {resource_id}")
            return None
    except json.JSONDecodeError:
        logging.error(f"Error decoding JSON (after extraction) for compute resource {resource_id}. Extracted string:\n{json_str[:200]}...")
        return None

    parsed['resource_id'] = resource_id
    parsed['_forecast_monthly'] = forecast['monthly']
    parsed['_forecast_annual'] = forecast['annually']
    return parsed


# Backwards-compatible wrappers (process lists but only the first element)
def get_storage_recommendation(data: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
    """Wrapper for backward compatibility, processes only the first resource."""
    if not data:
        return None
    # Only process first resource (single-resource flow)
    single = get_storage_recommendation_single(data[0])
    return [single] if single else None

def get_compute_recommendation(data: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
    """Wrapper for backward compatibility, processes only the first resource."""
    if not data:
        return None
    single = get_compute_recommendation_single(data[0])
    return [single] if single else None