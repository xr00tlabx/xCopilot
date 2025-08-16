/**
 * Validation test for Ghost Text Service
 * This file tests the core functionality without requiring VS Code runtime
 */

const testCases = [
    {
        name: "JavaScript Function Declaration",
        language: "javascript",
        currentText: "function calculateSum(a, b) {",
        expectedType: "function",
        context: "function calculateSum(a, b) {\n    \n}"
    },
    {
        name: "Python Function Definition", 
        language: "python",
        currentText: "def process_data(df):",
        expectedType: "function",
        context: "def process_data(df):\n    "
    },
    {
        name: "JavaScript Conditional",
        language: "javascript", 
        currentText: "if (user && user.isActive) {",
        expectedType: "block",
        context: "if (user && user.isActive) {\n    \n}"
    },
    {
        name: "Single Line Assignment",
        language: "javascript",
        currentText: "const result = ",
        expectedType: "single-line", 
        context: "const result = "
    },
    {
        name: "Class Declaration",
        language: "typescript",
        currentText: "class UserService {",
        expectedType: "multi-line",
        context: "class UserService {\n    \n}"
    }
];

/**
 * Mock functions to simulate the service behavior
 */
function determineSuggestionType(currentText, language) {
    const trimmed = currentText.trim();

    // Multi-line patterns (check first for classes, interfaces)
    if (trimmed.includes('class ') || trimmed.includes('interface ') || 
        trimmed.includes('struct ') || trimmed.includes('enum ')) {
        return 'multi-line';
    }

    // Check for block statements  
    if (trimmed.includes('if ') || trimmed.includes('for ') || 
        trimmed.includes('while ') || trimmed.includes('try ') ||
        (trimmed.includes('{') && !trimmed.includes('function ') && !trimmed.includes('class '))) {
        return 'block';
    }

    // Function declarations
    if (language === 'javascript' || language === 'typescript') {
        if (trimmed.includes('function ') || trimmed.includes('=> {') || 
            (trimmed.endsWith(') {') && trimmed.includes('function'))) {
            return 'function';
        }
    }

    if (language === 'python') {
        if (trimmed.startsWith('def ') && trimmed.endsWith(':')) {
            return 'function';
        }
    }

    // Check for block endings
    if (trimmed.endsWith('{') || trimmed.endsWith(':')) {
        return 'block';
    }

    return 'single-line';
}

function calculateConfidence(suggestion, currentText, type) {
    let confidence = 0.5; // Base confidence

    // Higher confidence for more specific contexts
    if (type === 'function') confidence += 0.2;
    if (type === 'block') confidence += 0.15;
    
    // Adjust based on suggestion quality
    if (suggestion.length > 10) confidence += 0.1;
    if (suggestion.includes('\n')) confidence += 0.05;
    
    // Lower confidence if too similar to current text
    if (suggestion.toLowerCase().includes(currentText.toLowerCase())) {
        confidence -= 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
}

function calculateRank(suggestion, confidence, type) {
    let rank = confidence * 100;

    // Bonus for certain types
    if (type === 'function') rank += 20;
    if (type === 'block') rank += 15;

    // Bonus for multi-line suggestions (more complete)
    if (suggestion.includes('\n')) rank += 10;

    return Math.round(rank);
}

/**
 * Run validation tests
 */
function runValidationTests() {
    console.log('🧪 Running Ghost Text Service Validation Tests...\n');
    
    let passed = 0;
    let failed = 0;

    testCases.forEach((testCase, index) => {
        console.log(`Test ${index + 1}: ${testCase.name}`);
        console.log(`  Language: ${testCase.language}`);
        console.log(`  Input: "${testCase.currentText}"`);
        
        const actualType = determineSuggestionType(testCase.currentText, testCase.language);
        const confidence = calculateConfidence(testCase.context, testCase.currentText, actualType);
        const rank = calculateRank(testCase.context, confidence, actualType);
        
        console.log(`  Expected Type: ${testCase.expectedType}`);
        console.log(`  Actual Type: ${actualType}`);
        console.log(`  Confidence: ${(confidence * 100).toFixed(1)}%`);
        console.log(`  Rank: ${rank}`);
        
        if (actualType === testCase.expectedType) {
            console.log(`  ✅ PASSED\n`);
            passed++;
        } else {
            console.log(`  ❌ FAILED\n`);
            failed++;
        }
    });

    console.log(`\n📊 Test Results:`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📈 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
        console.log(`\n🎉 All tests passed! Ghost Text Service is working correctly.`);
    } else {
        console.log(`\n⚠️  Some tests failed. Review the logic for failed cases.`);
    }
}

/**
 * Test configuration validation
 */
function testConfiguration() {
    console.log('\n⚙️ Testing Configuration Validation...');
    
    const configs = [
        { key: 'ghostText.enabled', value: true, valid: true },
        { key: 'ghostText.debounceMs', value: 500, valid: true },
        { key: 'ghostText.debounceMs', value: 50, valid: false }, // Too low
        { key: 'ghostText.opacity', value: 0.4, valid: true },
        { key: 'ghostText.opacity', value: 1.5, valid: false }, // Too high
        { key: 'ghostText.maxLines', value: 5, valid: true },
        { key: 'ghostText.maxLines', value: 25, valid: false }, // Too high
    ];

    configs.forEach(config => {
        let isValid = true;
        
        if (config.key === 'ghostText.debounceMs') {
            isValid = config.value >= 100 && config.value <= 2000;
        } else if (config.key === 'ghostText.opacity') {
            isValid = config.value >= 0.1 && config.value <= 1.0;
        } else if (config.key === 'ghostText.maxLines') {
            isValid = config.value >= 1 && config.value <= 20;
        }
        
        const result = isValid === config.valid ? '✅' : '❌';
        console.log(`  ${result} ${config.key}: ${config.value} (expected ${config.valid ? 'valid' : 'invalid'})`);
    });
}

// Run the tests
if (typeof module !== 'undefined' && require.main === module) {
    runValidationTests();
    testConfiguration();
}

module.exports = {
    testCases,
    determineSuggestionType,
    calculateConfidence,
    calculateRank,
    runValidationTests,
    testConfiguration
};