// Smart Refactoring Engine - Manual Test Cases
// This file can be used to manually test the implemented features

console.log('=== Smart Refactoring Engine Test Cases ===');

// Test Case 1: Long Function Detection (>20 lines)
function longFunctionTest() {
    console.log('Testing long function detection...');
    console.log('Line 1');
    console.log('Line 2');
    console.log('Line 3');
    console.log('Line 4');
    console.log('Line 5');
    console.log('Line 6');
    console.log('Line 7');
    console.log('Line 8');
    console.log('Line 9');
    console.log('Line 10');
    console.log('Line 11');
    console.log('Line 12');
    console.log('Line 13');
    console.log('Line 14');
    console.log('Line 15');
    console.log('Line 16');
    console.log('Line 17');
    console.log('Line 18');
    console.log('Line 19');
    console.log('Line 20');
    console.log('Line 21'); // This should trigger long function detection
}

// Test Case 2: Excessive Parameters (>5 parameters)
function excessiveParametersTest(param1, param2, param3, param4, param5, param6) {
    // This should trigger excessive parameters detection
    return param1 + param2 + param3 + param4 + param5 + param6;
}

// Test Case 3: Code Duplication
function duplicateCode1() {
    console.log('This is duplicate code that should be extracted');
}

function duplicateCode2() {
    console.log('This is duplicate code that should be extracted');
}

// Test Case 4: High Cyclomatic Complexity
function highComplexityTest(a, b, c, d) {
    if (a > 0 && b > 0 && c > 0 && d > 0) { // Should trigger complexity warning
        return true;
    }
    return false;
}

// Test Case 5: Magic Numbers
function magicNumbersTest(price) {
    if (price > 100) {
        return price * 0.15; // Magic number
    } else if (price > 50) {
        return price * 0.10; // Magic number
    }
    return price * 0.05; // Magic number
}

// Test Case 6: Callback to Async/Await Conversion
function callbackTest(id, callback) {
    database.findUser(id, function(err, user) {
        if (err) {
            callback(err, null);
        } else {
            callback(null, user);
        }
    });
}

// Test Case 7: Traditional Function to Arrow Function
const traditionalFunctionTest = function(x, y) {
    return x + y;
};

// Test Case 8: Destructuring Opportunity
function destructuringTest(user) {
    return user.firstName + ' ' + user.lastName + ' (' + user.email + ')';
}

// Expected Results:
// 1. longFunctionTest should show CodeLens: "💡 Extract function - Function too long"
// 2. excessiveParametersTest should show CodeLens: "💡 Extract to class - Too many parameters"
// 3. duplicateCode1/2 should show CodeLens: "💡 Extract method - Duplicate code"
// 4. highComplexityTest should show warning in Problems panel
// 5. magicNumbersTest should show info suggestions for magic numbers
// 6. callbackTest should show CodeLens: "💡 Convert to async/await"
// 7. traditionalFunctionTest should show CodeLens: "💡 Convert to arrow function"
// 8. destructuringTest should show CodeLens: "💡 Use destructuring"

console.log('Test cases loaded. Open this file in VS Code to see CodeLens suggestions.');