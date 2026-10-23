// Claude Code agents work in git worktrees under .claude/worktrees: each is a
// full copy of the repo, so their tests would otherwise run here too.
module.exports = {
  testPathIgnorePatterns: ["/node_modules/", "/.claude/"],
  modulePathIgnorePatterns: ["/.claude/"],
};
