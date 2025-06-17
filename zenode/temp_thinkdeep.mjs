
import { ThinkDeepTool } from "./dist/tools/thinkdeep.js";

const tool = new ThinkDeepTool();

const prompt = `
ZENODE:THINKDEEP ANALYSIS: GRUNTS CROSS-PLATFORM COMPATIBILITY  

Analyze the fundamental assumptions in the grunts tool implementation for cross-platform deployment scenarios:

1. PLATFORM ASSUMPTIONS:
   - What platform-specific assumptions does the grunts tool make?
   - How does it handle differences between Mac, Windows, and Linux?
   - Are Docker platform specifications hardcoded or adaptive?

2. DOCKER BEHAVIOR ASSUMPTIONS:
   - Does it assume Docker Desktop is installed vs Docker Engine?
   - How does it handle ARM64 vs AMD64 architecture differences?
   - What about Docker permissions and user access patterns?

3. FILE SYSTEM ASSUMPTIONS:
   - Path handling across different OS file systems
   - Volume mounting behavior differences
   - Permission models (Unix vs Windows)

4. DEPENDENCY CHAIN ANALYSIS:
   - What external tools does grunts assume are available?
   - How does it handle missing dependencies?
   - What happens on a fresh clone with minimal setup?

5. NETWORKING ASSUMPTIONS:
   - Port availability and binding behavior  
   - Localhost vs host.docker.internal differences
   - Firewall and network stack differences

6. "OUT-OF-THE-BOX" REALITY CHECK:
   - What would actually happen on a fresh Mac/Windows/Linux clone?
   - What manual setup steps are hidden or assumed?
   - What would break first on each platform?

Think deeply about these fundamental architectural assumptions and their real-world implications.
`;

try {
  const result = await tool.execute({
    prompt: prompt,
    model: "auto", 
    thinking_mode: "high",
    use_websearch: false
  });

  console.log("=== ZENODE:THINKDEEP PERSPECTIVE ===");
  console.log(result.content);
} catch (error) {
  console.error("ThinkDeep failed:", error.message);
}

