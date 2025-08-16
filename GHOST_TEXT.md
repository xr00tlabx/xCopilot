# 👻 xCopilot Ghost Text Suggestions

## 🎯 Overview

Ghost Text Suggestions provide real-time, intelligent code completions that appear as grayed-out inline text, similar to GitHub Copilot. The suggestions appear automatically as you type and can be accepted with **Tab** or dismissed with **Esc**.

## ✨ Features

### 🎨 Visual Experience
- **Real Ghost Text**: Appears as grayed-out inline text (not comments)
- **Smooth Integration**: Uses VS Code's native `InlineCompletionItemProvider` API
- **Professional Look**: Matches GitHub Copilot's visual appearance

### 🎮 User Interaction
- **Tab Key**: Accept the current suggestion
- **Esc Key**: Dismiss/cancel the current suggestion
- **Automatic Triggering**: Suggestions appear automatically while typing
- **Context Aware**: Only appears when contextually appropriate

### 🧠 Intelligence
- **Multi-language Support**: JavaScript, TypeScript, Python, Java, C#, C++, Go, Rust, PHP, Ruby, Swift, Kotlin
- **Context Analysis**: Analyzes surrounding code for intelligent suggestions
- **Smart Triggering**: Only suggests when cursor is at end of line with sufficient context
- **Performance Optimized**: < 300ms response time with intelligent throttling

## ⚙️ Configuration

### Settings
Navigate to **Settings → Extensions → xCopilot** or add to `settings.json`:

```json
{
  "xcopilot.ghostText.enabled": true,
  "xcopilot.ghostText.throttleMs": 300
}
```

### Available Settings
- **`xcopilot.ghostText.enabled`** (boolean, default: `true`)
  - Enable/disable Ghost Text suggestions
- **`xcopilot.ghostText.throttleMs`** (number, default: `300`)
  - Minimum time between suggestion requests (100-1000ms)

## 🎮 Usage

### Basic Usage
1. **Start typing** in any supported language file
2. **Position cursor** at the end of a line with code context
3. **Wait briefly** for ghost text to appear (grayed-out text)
4. **Press Tab** to accept the suggestion
5. **Press Esc** to dismiss the suggestion

### Example Scenarios

#### Function Completion
```javascript
function calculateSum(a, b) {
    // Ghost text suggests: return a + b;
```

#### Class Implementation
```javascript
class UserManager {
    // Ghost text suggests: constructor() { ... }
```

#### Conditional Logic
```javascript
if (user.isActive) {
    // Ghost text suggests: console.log('User is active');
```

#### Loop Implementation
```javascript
for (let i = 0; i < items.length; i++) {
    // Ghost text suggests: console.log(items[i]);
```

## 🎯 Smart Triggering

Ghost Text only appears when:
- ✅ Cursor is at the end of a line
- ✅ Line has sufficient context (3+ characters)
- ✅ Not inside comments or strings
- ✅ In a supported language file
- ✅ Service is enabled in settings

## 🔧 Commands

### Available Commands
- **`xCopilot: Aceitar Sugestão Ghost Text`** - Accept current suggestion
- **`xCopilot: Descartar Sugestão Ghost Text`** - Dismiss current suggestion

### Keybindings
- **Tab** - Accept suggestion (when `xcopilot.ghostTextVisible`)
- **Esc** - Dismiss suggestion (when `xcopilot.ghostTextVisible`)

## 🐛 Troubleshooting

### No Ghost Text Appearing?
1. **Check settings**: Ensure `xcopilot.ghostText.enabled` is `true`
2. **Verify backend**: Backend should be running on `localhost:3000`
3. **Check cursor position**: Cursor must be at end of line
4. **Check context**: Line needs 3+ characters of code
5. **Wait for throttle**: Default 300ms delay between requests

### Ghost Text Not Dismissing?
1. **Press Esc** to manually dismiss
2. **Move cursor** to automatically clear
3. **Check keybindings** in VS Code settings

### Performance Issues?
1. **Increase throttle**: Set higher `ghostText.throttleMs` value
2. **Check backend**: Ensure backend is responsive
3. **Check logs**: Open VS Code Output → xCopilot for debug info

## 🏗️ Technical Implementation

### Architecture
```
GhostTextService (InlineCompletionItemProvider)
    ↓ Context Analysis
Backend /api/completion endpoint  
    ↓ AI Processing
OpenAI optimized completion
    ↓ Response Processing
VS Code native ghost text rendering
```

### Key Features
- **InlineCompletionItemProvider**: Uses VS Code's native API
- **Context Management**: Tracks `xcopilot.ghostTextVisible` context
- **Performance Optimized**: Throttling and intelligent triggering
- **Multi-language**: Supports 12+ programming languages

## 📊 Comparison with Inline Completion

| Feature | Ghost Text | Inline Completion |
|---------|------------|-------------------|
| Trigger | End of line typing | Any position typing |
| Visual | Grayed ghost text | Popup suggestions |
| Accept | Tab key | Tab/Enter key |
| Context | Line-focused | Broad context |
| Purpose | Quick completions | Comprehensive suggestions |

## 🚀 Future Enhancements

- [ ] **Multi-line suggestions** for complex code blocks
- [ ] **Learning from patterns** in workspace
- [ ] **Advanced context analysis** for better suggestions
- [ ] **Custom trigger characters** configuration
- [ ] **Suggestion confidence scoring**

---

**Made with ❤️ by xCopilot Team**