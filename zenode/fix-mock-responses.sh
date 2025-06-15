#!/bin/bash
# Script to fix all mock responses in zenode tools

echo "Fixing mock responses in all zenode tools..."

# Fix analyze.ts
echo "Fixing analyze.ts..."
sed -i '' 's/const mockResponse = `/const response = await provider.generateResponse(modelRequest);/' src/tools/analyze.ts
sed -i '' 's/const formattedResponse = this.formatResponse(mockResponse, validatedRequest);/const formattedResponse = this.formatResponse(response.content, validatedRequest);/' src/tools/analyze.ts

# Fix debug.ts  
echo "Fixing debug.ts..."
sed -i '' 's/const mockResponse = `/const response = await provider.generateResponse(modelRequest);/' src/tools/debug.ts
sed -i '' 's/mockResponse,/response.content,/' src/tools/debug.ts

# Fix precommit.ts
echo "Fixing precommit.ts..."
sed -i '' 's/const mockResponse = `/const response = await provider.generateResponse(modelRequest);/' src/tools/precommit.ts
sed -i '' 's/mockResponse,/response.content,/' src/tools/precommit.ts

# Fix testgen.ts
echo "Fixing testgen.ts..."
sed -i '' 's/const mockResponse = `/const response = await provider.generateResponse(modelRequest);/' src/tools/testgen.ts
sed -i '' 's/const specialStatus = parseSpecialStatus(mockResponse);/const specialStatus = parseSpecialStatus(response.content);/' src/tools/testgen.ts
sed -i '' 's/mockResponse,/response.content,/' src/tools/testgen.ts

# Fix thinkdeep.ts
echo "Fixing thinkdeep.ts..."
sed -i '' "s/const mockResponse = 'Deep analysis response would go here...';/const response = await provider.generateResponse(modelRequest);/" src/tools/thinkdeep.ts
sed -i '' 's/const formattedResponse = this.formatResponse(mockResponse, validatedRequest);/const formattedResponse = this.formatResponse(response.content, validatedRequest);/' src/tools/thinkdeep.ts

echo "All mock responses fixed! Now rebuilding..."
npm run build

echo "Done!"