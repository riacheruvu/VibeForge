"""
VibeCheckBench local runner - llama.cpp backend (llama-cpp-python).

Requires:
    pip install llama-cpp-python

Set VIBECHECKBENCH_GGUF_PATH to the GGUF model file you want to use, e.g.:
    export VIBECHECKBENCH_GGUF_PATH=~/models/phi-3-mini-4k-instruct-q4.gguf

If VIBECHECKBENCH_GGUF_PATH is not set, the runner will exit with a clear error.
"""

import argparse
import json
import os
import random
import re
import sys
import time

DEFAULT_TEST_CASES = min(20, max(1, int(os.environ.get("VIBECHECKBENCH_NUM_CASES", "10"))))
DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant."
DEFAULT_LOCAL_FAST = os.environ.get("VIBECHECKBENCH_LOCAL_FAST", "1").strip().lower() not in {"0", "false", "no"}
GGUF_PATH = os.environ.get("VIBECHECKBENCH_GGUF_PATH", "").strip()

CTX_SIZE = int(os.environ.get("VIBECHECKBENCH_CTX_SIZE", "2048"))
N_THREADS = int(os.environ.get("VIBECHECKBENCH_N_THREADS", "4"))
N_GPU_LAYERS = int(os.environ.get("VIBECHECKBENCH_N_GPU_LAYERS", "0"))  # 0 = CPU only


def load_llama(model_path):
    try:
        from llama_cpp import Llama
    except ImportError:
        print(
            "llama-cpp-python is not installed.\n"
            "Run: pip install llama-cpp-python",
            file=sys.stderr,
        )
        sys.exit(1)

    return Llama(
        model_path=model_path,
        n_ctx=CTX_SIZE,
        n_threads=N_THREADS,
        n_gpu_layers=N_GPU_LAYERS,
        verbose=False,
    )


def chat(llm, system, user_prompt, max_tokens):
    response = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=max_tokens,
        temperature=0.0,
    )
    text = response["choices"][0]["message"]["content"].strip()
    if not text:
        raise ValueError("Model response did not include text content.")
    return text


def parse_args():
    parser = argparse.ArgumentParser(description="Run VibeCheckBench against a local GGUF model via llama-cpp-python.")
    parser.add_argument("--intent", required=True, help="Benchmark target behavior")
    parser.add_argument("--prompt", default=None, help="Custom system prompt for config B")
    parser.add_argument("--prompt-file", default=None, help="Read the custom system prompt from a file")
    parser.add_argument("--cases", type=int, default=DEFAULT_TEST_CASES, help="Number of cases (1-20)")
    parser.add_argument("--model", default=GGUF_PATH, help="Path to GGUF model file (overrides VIBECHECKBENCH_GGUF_PATH)")
    parser.add_argument("--json", action="store_true", help="Print JSON report")
    return parser.parse_args()


def load_prompt(args):
    if args.prompt and args.prompt_file:
        raise ValueError("Use either --prompt or --prompt-file, not both.")
    if args.prompt_file:
        with open(args.prompt_file, "r", encoding="utf-8") as handle:
            return handle.read().strip()
    return args.prompt


def parse_json_payload(raw_text, expected_label):
    text = raw_text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        array_match = re.search(r"\[[\s\S]*\]", text)
        if array_match:
            return json.loads(array_match.group(0))
        object_match = re.search(r"\{[\s\S]*\}", text)
        if object_match:
            return json.loads(object_match.group(0))
    raise ValueError(f"Failed to parse {expected_label} JSON.")


def generate_test_cases(llm, user_intent, test_cases):
    raw = chat(
        llm,
        (
            "You are an AI evaluation expert.\n"
            "Generate realistic and discriminating prompts for a personal benchmark.\n\n"
            f"Rules:\n- Generate exactly {test_cases} prompts\n"
            "- Each prompt should feel like a real user request\n"
            "- Vary style, context, and complexity\n"
            "- Return only a JSON array of strings"
        ),
        f'Generate {test_cases} test prompts to evaluate this user preference:\n"{user_intent}"',
        120 if DEFAULT_LOCAL_FAST else 500,
    )
    parsed = parse_json_payload(raw, "test case")
    if not isinstance(parsed, list) or not parsed:
        raise ValueError("The generated test cases were empty.")
    return [str(item).strip() for item in parsed[:test_cases] if str(item).strip()]


def run_prompt(llm, prompt, system_prompt):
    return chat(llm, system_prompt or DEFAULT_SYSTEM_PROMPT, prompt, 64 if DEFAULT_LOCAL_FAST else 220)


def score_outputs(llm, prompt, output_a, output_b, user_intent):
    swap = random.random() >= 0.5
    left = output_b if swap else output_a
    right = output_a if swap else output_b
    raw = chat(
        llm,
        (
            "You are a strict, impartial evaluator.\n"
            "Judge only against the stated user preference.\n"
            'Return only valid JSON in the shape {"winner":"A"|"B"|"tie","reason":"one short sentence"}.'
        ),
        (
            f'User preference: "{user_intent}"\n\n'
            f"Prompt:\n{prompt}\n\n"
            f"Response A:\n{left}\n\n"
            f"Response B:\n{right}"
        ),
        48 if DEFAULT_LOCAL_FAST else 180,
    )
    parsed = parse_json_payload(raw, "score")
    external_winner = parsed.get("winner")
    reason = str(parsed.get("reason", "No reason provided.")).strip()
    if external_winner == "tie":
        return {"winner": "tie", "reason": reason}
    if external_winner not in {"A", "B"}:
        return {"winner": "tie", "reason": "Judge returned an invalid winner."}
    internal_winner = "A" if ((external_winner == "A" and not swap) or (external_winner == "B" and swap)) else "B"
    return {"winner": internal_winner, "reason": reason}


def analyze_losses(llm, losses, user_intent, config_b_prompt):
    if not losses:
        return None
    loss_lines = "\n\n".join(
        f"{i + 1}. Prompt: {loss['prompt']}\nReason: {loss['reason']}"
        for i, loss in enumerate(losses)
    )
    return chat(
        llm,
        (
            "You are an AI prompt engineering expert.\n"
            "Analyze why a system prompt underperformed.\n"
            "Be concise and actionable."
        ),
        (
            f'User preference: "{user_intent}"\n\n'
            f'Current system prompt:\n"{config_b_prompt}"\n\n'
            f"Cases where config B lost:\n{loss_lines}\n\n"
            "Write 2-3 sentences describing the main weaknesses."
        ),
        96 if DEFAULT_LOCAL_FAST else 160,
    )


def generate_improved_prompt(llm, user_intent, config_b_prompt, weakness_analysis):
    return chat(
        llm,
        (
            "You are an expert prompt engineer.\n"
            "Rewrite the system prompt so it better matches the user preference.\n"
            "Return only the improved prompt text."
        ),
        (
            f'User preference: "{user_intent}"\n\n'
            f'Current system prompt:\n"{config_b_prompt}"\n\n'
            f"Weakness analysis:\n{weakness_analysis}"
        ),
        96 if DEFAULT_LOCAL_FAST else 180,
    )


def run_VibeCheckBench(user_intent, config_b_prompt, model_path, test_cases):
    if not model_path:
        print(
            "No GGUF model path provided.\n"
            "Set VIBECHECKBENCH_GGUF_PATH or pass --model <path/to/model.gguf>",
            file=sys.stderr,
        )
        sys.exit(1)

    llm = load_llama(model_path)
    config_b = config_b_prompt or f"You are a helpful AI assistant. Prioritize this user preference: {user_intent}."
    start_time = time.time()
    prompts = generate_test_cases(llm, user_intent, test_cases)
    wins = {"A": 0, "B": 0, "tie": 0}
    results = []
    losses = []

    for prompt in prompts:
        output_a = run_prompt(llm, prompt, DEFAULT_SYSTEM_PROMPT)
        output_b = run_prompt(llm, prompt, config_b)
        score = score_outputs(llm, prompt, output_a, output_b, user_intent)
        if score["winner"] not in wins:
            score["winner"] = "tie"
        wins[score["winner"]] += 1
        results.append({"prompt": prompt, "outputA": output_a, "outputB": output_b, "score": score})
        if score["winner"] == "A":
            losses.append({"prompt": prompt, "reason": score["reason"], "outputA": output_a, "outputB": output_b})

    weakness_analysis = analyze_losses(llm, losses, user_intent, config_b)
    improved_prompt = None
    if weakness_analysis:
        improved_prompt = generate_improved_prompt(llm, user_intent, config_b, weakness_analysis)

    duration_seconds = f"{time.time() - start_time:.1f}s"
    ab_total = wins["A"] + wins["B"]
    win_rate = f"{round((wins['B'] / ab_total) * 100) if ab_total else 0}%"  # excludes ties
    if wins["B"] > wins["A"]:
        verdict = "Config B performed better."
    elif wins["A"] > wins["B"]:
        verdict = "The default assistant performed better."
    else:
        verdict = "The benchmark ended in a tie."

    return {
        "intent": user_intent,
        "provider": "local-llamacpp",
        "model": model_path,
        "testCaseCount": len(prompts),
        "scores": wins,
        "winRate": win_rate,
        "verdict": verdict,
        "configBPrompt": config_b,
        "weaknesses": weakness_analysis,
        "improvedPrompt": improved_prompt,
        "duration": duration_seconds,
        "testCases": results,
    }


def main():
    args = parse_args()
    test_cases = min(20, max(1, args.cases))
    prompt = load_prompt(args)
    report = run_VibeCheckBench(args.intent, prompt, args.model, test_cases)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"VibeCheckBench local error: {error}", file=sys.stderr)
        sys.exit(1)
