// Smart Refactoring Engine Demo
// This file demonstrates the new Smart Refactoring Engine features

class UserService {
    // Function with too many parameters (>5) - should trigger CodeLens
    createUser(firstName, lastName, email, phone, address, city, state, zipCode) {
        // Long function (>20 lines) - should trigger CodeLens
        if (!firstName) {
            throw new Error('First name is required');
        }
        if (!lastName) {
            throw new Error('Last name is required');
        }
        if (!email) {
            throw new Error('Email is required');
        }
        if (!phone) {
            throw new Error('Phone is required');
        }
        if (!address) {
            throw new Error('Address is required');
        }
        if (!city) {
            throw new Error('City is required');
        }
        if (!state) {
            throw new Error('State is required');
        }
        if (!zipCode) {
            throw new Error('Zip code is required');
        }
        
        const user = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            phone: phone,
            address: address,
            city: city,
            state: state,
            zipCode: zipCode
        };
        
        return user;
    }

    // Callback code that can be modernized to async/await
    getUserById(id, callback) {
        database.findUser(id, function(err, user) {
            if (err) {
                callback(err, null);
            } else {
                callback(null, user);
            }
        });
    }

    // Traditional function that can be converted to arrow function
    processUsers(users) {
        return users.map(function(user) {
            return user.name.toUpperCase();
        });
    }

    // Code that can use destructuring
    formatUserInfo(user) {
        return user.firstName + ' ' + user.lastName + ' (' + user.email + ')';
    }
    
    // Duplicated validation logic - Extract Method opportunity
    validateEmail(email) {
        if (!email) {
            throw new Error('Email is required');
        }
        return true;
    }
    
    validateEmailAgain(email) {
        if (!email) {
            throw new Error('Email is required');
        }
        return true;
    }
}

// High cyclomatic complexity - should trigger warning
function complexCalculation(a, b, c, d) {
    if (a > 0 && b > 0 && c > 0 && d > 0) {
        return a + b + c + d;
    }
    return 0;
}

// Magic numbers that should be extracted to constants
function calculateDiscount(price) {
    if (price > 100) {
        return price * 0.15; // Magic number 0.15
    } else if (price > 50) {
        return price * 0.10; // Magic number 0.10
    }
    return price * 0.05; // Magic number 0.05
}