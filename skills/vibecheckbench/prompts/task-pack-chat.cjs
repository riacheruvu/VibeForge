module.exports = async function buildTaskPackChatPrompt({ vars }) {
  let turns = [];
  try {
    turns = JSON.parse(vars.turns_json || "[]");
  } catch {
    throw new Error("turns_json must contain a JSON array of chat messages");
  }

  return [
    {
      role: "system",
      content: [
        "You are being evaluated for user-fit, not generic benchmark performance.",
        "Use the user's profile and conversation context.",
        "Be concise, honest, useful, and clear about uncertainty.",
        vars.config_prompt ? `Configuration instructions: ${vars.config_prompt}` : "",
        "",
        `User profile: ${vars.user_profile || ""}`,
      ].filter(Boolean).join("\n"),
    },
    ...turns,
  ];
};
