
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import pandas as pd

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"

ml_model = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load model and threshold when the application starts
    ml_model["model"] = joblib.load(
        BASE_DIR / "credit_risk_model.pkl"
    )

    ml_model["best_threshold"] = float(
        joblib.load(BASE_DIR / "best_threshold.pkl")
    )

    print("Model loaded successfully!")
    print("Best threshold:", ml_model["best_threshold"])

    yield

    ml_model.clear()


app = FastAPI(
    title="Credence - Credit Risk Prediction API",
    description="Credit default risk prediction using machine learning.",
    version="1.0.0",
    lifespan=lifespan
)


class LoanApplication(BaseModel):
    person_age: int = Field(gt=0)
    person_income: float = Field(gt=0)
    person_home_ownership: str
    person_emp_length: float = Field(ge=0)
    loan_intent: str
    loan_grade: str
    loan_amnt: float = Field(gt=0)
    loan_int_rate: float = Field(gt=0)
    loan_percent_income: float = Field(gt=0)
    cb_person_default_on_file: str
    cb_person_cred_hist_length: int = Field(ge=0)


@app.post("/predict")
def predict(data: LoanApplication):

    input_df = pd.DataFrame([data.model_dump()])

    model = ml_model["model"]

    probabilities = model.predict_proba(input_df)

    # Find probability corresponding to default class 1
    class_index = list(model.classes_).index(1)

    probability = float(
        probabilities[0, class_index]
    )

    threshold = ml_model["best_threshold"]

    prediction = int(probability >= threshold)

    return {
        "default_probability": probability,
        "default_prediction": prediction,
        "threshold": threshold,
        "Result": "High Risk" if prediction == 1 else "Low Risk"
    }


# Serve the frontend AFTER defining API routes.
# This allows /predict to be handled by FastAPI first.
app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend"
)
