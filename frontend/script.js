const API_URL = "https://your-service.onrender.com/predict";

const form = document.getElementById("loan-form");
const analyzeBtn = document.getElementById("analyze-btn");
const formError = document.getElementById("form-error");
const resultEmpty = document.getElementById("result-empty");
const resultContent = document.getElementById("result-content");
const apiError = document.getElementById("api-error");
const lastRequest = { payload: null };

const samples = {
  low: {
    person_age: 30, person_income: 100000, person_home_ownership: "OWN",
    person_emp_length: 8, loan_intent: "EDUCATION", loan_grade: "A",
    loan_amnt: 5000, loan_int_rate: 7.5, loan_percent_income: 0.05,
    cb_person_default_on_file: "N", cb_person_cred_hist_length: 8
  },
  medium: {
    person_age: 26, person_income: 55000, person_home_ownership: "RENT",
    person_emp_length: 3, loan_intent: "PERSONAL", loan_grade: "C",
    loan_amnt: 12000, loan_int_rate: 13.5, loan_percent_income: 0.2182,
    cb_person_default_on_file: "N", cb_person_cred_hist_length: 4
  },
  high: {
    person_age: 22, person_income: 25000, person_home_ownership: "RENT",
    person_emp_length: 0.5, loan_intent: "MEDICAL", loan_grade: "G",
    loan_amnt: 10000, loan_int_rate: 19.5, loan_percent_income: 0.4,
    cb_person_default_on_file: "Y", cb_person_cred_hist_length: 3
  }
};

function setFormValues(values) {
  Object.entries(values).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (field) field.value = value;
  });
}

document.querySelectorAll("[data-sample]").forEach(button => {
  button.addEventListener("click", () => {
    setFormValues(samples[button.dataset.sample]);
    formError.textContent = "";
    button.blur();
  });
});

const incomeInput = form.elements.person_income;
const amountInput = form.elements.loan_amnt;
const ratioInput = document.getElementById("loan-percent-income");
function updateRatio() {
  const income = Number(incomeInput.value);
  const amount = Number(amountInput.value);
  if (income > 0 && amount > 0) ratioInput.value = (amount / income).toFixed(4);
}
incomeInput.addEventListener("input", updateRatio);
amountInput.addEventListener("input", updateRatio);

function showOnly(view) {
  resultEmpty.classList.toggle("hidden", view !== "empty");
  resultContent.classList.toggle("hidden", view !== "result");
  apiError.classList.toggle("hidden", view !== "error");
}

function setLoading(loading) {
  analyzeBtn.disabled = loading;
  analyzeBtn.classList.toggle("loading", loading);
  analyzeBtn.querySelector(".btn-label").textContent = loading ? "Analyzing application..." : "Analyze application";
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function displayResult(data) {
  const probability = Number(data.default_probability);
  const threshold = Number(data.threshold);
  const prediction = Number(data.default_prediction);

  if (!Number.isFinite(probability) || !Number.isFinite(threshold) || ![0, 1].includes(prediction)) {
    throw new Error("The API returned an unexpected response. Check the response fields in your FastAPI endpoint.");
  }

  const isHigh = prediction === 1;
  const color = isHigh ? "#ff858d" : "#65dfb0";
  const gauge = document.getElementById("risk-gauge");
  gauge.style.setProperty("--gauge-color", color);
  gauge.style.setProperty("--progress", `${Math.max(0, Math.min(1, probability)) * 360}deg`);

  document.getElementById("probability-value").textContent = formatPercent(probability);
  document.getElementById("risk-status").classList.toggle("high", isHigh);
  document.getElementById("risk-status-text").textContent = isHigh ? "HIGH RISK" : "LOW RISK";
  document.getElementById("result-description").textContent = isHigh
    ? "The estimated probability is at or above the model's decision threshold. This application is classified as higher default risk by the model."
    : "The estimated probability is below the model's decision threshold. This application is classified as lower default risk by the model.";
  document.getElementById("prediction-value").textContent = isHigh ? "1 · High Risk" : "0 · Low Risk";
  document.getElementById("threshold-value").textContent = formatPercent(threshold);
  document.getElementById("threshold-marker").style.left = `${Math.max(0, Math.min(1, threshold)) * 100}%`;
  document.getElementById("probability-marker").style.left = `${Math.max(0, Math.min(1, probability)) * 100}%`;

  showOnly("result");
}

async function submitPrediction(payload) {
  setLoading(true);
  formError.textContent = "";
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    let data;
    try { data = await response.json(); }
    catch { throw new Error(`The API returned an unreadable response (HTTP ${response.status}).`); }

    if (!response.ok) {
      const detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
      throw new Error(detail || `Request failed with HTTP ${response.status}.`);
    }

    displayResult(data);
  } catch (error) {
    document.getElementById("api-error-message").textContent =
      error.message.includes("Failed to fetch")
        ? "Could not connect to http://127.0.0.1:8000. Start FastAPI and check CORS settings."
        : error.message;
    showOnly("error");
  } finally {
    setLoading(false);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  formError.textContent = "";
  if (!form.reportValidity()) return;

  const fd = new FormData(form);
  const payload = {
    person_age: Number(fd.get("person_age")),
    person_income: Number(fd.get("person_income")),
    person_home_ownership: fd.get("person_home_ownership"),
    person_emp_length: Number(fd.get("person_emp_length")),
    loan_intent: fd.get("loan_intent"),
    loan_grade: fd.get("loan_grade"),
    loan_amnt: Number(fd.get("loan_amnt")),
    loan_int_rate: Number(fd.get("loan_int_rate")),
    loan_percent_income: Number(fd.get("loan_percent_income")),
    cb_person_default_on_file: fd.get("cb_person_default_on_file"),
    cb_person_cred_hist_length: Number(fd.get("cb_person_cred_hist_length"))
  };

  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      formError.textContent = `Please enter a valid number for ${key.replaceAll("_", " ")}.`;
      return;
    }
  }
  if (payload.loan_percent_income <= 0) {
    formError.textContent = "Loan / income ratio must be greater than zero.";
    return;
  }
  lastRequest.payload = payload;
  submitPrediction(payload);
});

document.getElementById("reset-btn").addEventListener("click", () => {
  showOnly("empty");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.getElementById("retry-btn").addEventListener("click", () => {
  if (lastRequest.payload) submitPrediction(lastRequest.payload);
  else showOnly("empty");
});

// Keep the initial ratio consistent with the default form values.
updateRatio();
