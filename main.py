
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI
from pydantic import BaseModel, Field
import joblib
import pandas as pd

ml_model = {}

BASE_DIR = Path(__file__).resolve().parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    ml_model["model"] = joblib.load(BASE_DIR / "credit_risk_model.pkl")
    ml_model["best_threshold"] = float(
        joblib.load(BASE_DIR / "best_threshold.pkl")
    )

    print("Model loaded successfully!")
    print("Best threshold:", ml_model["best_threshold"])

    yield

    ml_model.clear()


app = FastAPI(lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://credit-risk-prediction-using-shap-1.onrender.com/"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
def greet():
    return {"message": "Hello, Anubhav!"}


@app.post("/predict")
def predict(data: LoanApplication):

    input_df = pd.DataFrame([data.model_dump()])

    model = ml_model["model"]

    probabilities = model.predict_proba(input_df)

    # Find the probability corresponding to the default class (1)
    class_index = list(model.classes_).index(1)
    probability = float(probabilities[0, class_index])

    threshold = ml_model["best_threshold"]

    prediction = int(probability >= threshold)

    return {
        "default_probability": probability,
        "default_prediction": prediction,
        "threshold": threshold,
        "Result": "High Risk" if prediction == 1 else "Low Risk"
    }
