export default class VibeCheckBenchAlignedProvider {
  id = () => "VibeCheckBench-aligned-mock";

  callApi = async (_prompt, context) => {
    const preferenceId = context?.vars?.preference_id || "";
    const userPrompt = context?.vars?.user_prompt || "";

    if (preferenceId === "mechanism_first_framing") {
      return {
        output: [
          "Mechanistically, I would not frame this as intent or desire.",
          "The safer explanation is a learned response pattern under the prompt, context, and reward-shaped behavior.",
          "Known facts, assumptions, and inferences should be separated, and the next test is to compare outputs across prompts and models.",
        ].join(" "),
      };
    }

    if (preferenceId === "operational_reality_check") {
      return {
        output: [
          "I would not treat that as ready yet.",
          "A working demo is weak evidence for operational review because deployment constraints, authority boundaries, failure modes, and user trust are still untested.",
          "The smaller next step is a scoped validation with explicit criteria and review risks.",
        ].join(" "),
      };
    }

    if (preferenceId === "concise_high_signal") {
      if (/5 bullets/i.test(userPrompt)) {
        return {
          output: [
            "- Worth testing, not overclaiming.",
            "- Use seeded cases.",
            "- Track failures.",
            "- Keep rubrics simple.",
            "- Compare against real workflows.",
          ].join("\n"),
        };
      }

      return {
        output: "Proceed with a small regression test because it reduces uncertainty without turning the prototype into a grand claim.",
      };
    }

    return {
      output: "I would test this with evidence, criteria, uncertainty, and a concrete next step rather than validating the premise.",
    };
  };
}
