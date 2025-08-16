// Test file with various code quality issues for xCopilot Code Review

function badFunction() {
    // This function is intentionally poorly written to test code review
    var password = "hardcoded_password"; // Security issue
    let x = 5; // Short variable name
    let y = 10; // Magic number
    
    // Complex conditional logic 
    if (x > 0 && y < 20 && password.length > 5 && x !== y && password !== "admin") {
        console.log("Complex condition");
    }
    
    // Duplicated code
    console.log("Processing data...");
    console.log("Processing data...");
    
    // Long function simulation
    let result = 0;
    for (let i = 0; i < 100; i++) {
        for (let j = 0; j < 50; j++) { // Nested loops
            result += i * j;
            if (result > 1000) {
                result = result / 2;
            }
            if (result < 0) {
                result = 0;
            }
        }
    }
    
    // Eval usage (security risk)
    eval("console.log('This is dangerous')");
    
    // SQL injection pattern
    let query = "SELECT * FROM users WHERE id = " + x;
    
    return result;
}

// Function without documentation
function anotherFunction(data) {
    return data.map(item => item.value).reduce((acc, val) => acc + val, 0);
}

// Missing tests for these functions