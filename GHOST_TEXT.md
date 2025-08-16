# 👻 xCopilot Ghost Text Suggestions

xCopilot now features **GitHub Copilot-level ghost text suggestions** with contextual AI-powered completions that appear as you type!

## ✨ Features

### 🎯 Intelligent Ghost Text
- **Real-time suggestions** appear as gray ghost text while typing
- **Context-aware** completions based on surrounding code and file analysis
- **Multi-language support**: JavaScript, TypeScript, Python, Java, C#, C++, Go, Rust, PHP, Ruby, Swift, Kotlin

### 🎮 Easy Controls
- **Tab** to accept ghost text suggestions
- **Esc** to reject/dismiss suggestions  
- **Ctrl+Alt+G** to toggle ghost text on/off
- **Visual indicators** show available actions

### 🧠 Smart Suggestions
- **Single-line completions** for statements and expressions
- **Multi-line suggestions** for functions, classes, and code blocks
- **Context analysis** determines the best suggestion type
- **Ranking system** prioritizes most relevant suggestions

### 🎨 Customizable Appearance
- **Configurable opacity** for ghost text transparency
- **Smooth animations** when suggestions appear
- **Preview tooltips** with explanations (optional)
- **Color customization** through VS Code themes

## 🎮 Usage

### Basic Usage
1. **Start typing** in any supported language file
2. **Ghost text appears** in gray after a brief delay (500ms default)
3. **Press Tab** to accept the suggestion
4. **Press Esc** to dismiss the suggestion

### Advanced Features
- **Hover over ghost text** to see explanation tooltip (if enabled)
- **Multi-line suggestions** automatically appear for function/class declarations
- **Context switching** adapts suggestions based on what you're writing

## ⚙️ Configuration

Navigate to **Settings → Extensions → xCopilot** to customize:

```json
{
  "xcopilot.ghostText.enabled": true,
  "xcopilot.ghostText.debounceMs": 500,
  "xcopilot.ghostText.opacity": 0.4,
  "xcopilot.ghostText.multiLine": true,
  "xcopilot.ghostText.maxLines": 5,
  "xcopilot.ghostText.showPreview": true,
  "xcopilot.ghostText.ranking": true
}
```

### Configuration Options
- **enabled**: Enable/disable ghost text suggestions
- **debounceMs**: Delay before showing suggestions (100-2000ms)
- **opacity**: Ghost text transparency (0.1-1.0)
- **multiLine**: Allow multi-line suggestions for functions/classes
- **maxLines**: Maximum lines for multi-line suggestions (1-20)
- **showPreview**: Show explanation tooltips on hover
- **ranking**: Enable intelligent suggestion ranking

## 🎯 Suggestion Types

### Single-line Completions
```javascript
console.log(|) // Ghost text suggests: '"Hello, World!"'
const result = |  // Ghost text suggests: 'calculateSum(a, b)'
```

### Multi-line Function Suggestions
```javascript
function calculateSum(a, b) {| 
// Ghost text suggests complete function body:
//   return a + b;
// }
```

### Block Suggestions
```python
if user_authenticated:|
# Ghost text suggests:
#     print("Welcome!")
#     return True
```

### Class/Interface Suggestions
```typescript
interface User {|
// Ghost text suggests:
//   id: number;
//   name: string;
//   email: string;
// }
```

## 🚀 Commands

Access these commands via **Ctrl+Shift+P**:

- **xCopilot: Toggle Ghost Text** - Enable/disable ghost text (`Ctrl+Alt+G`)
- **xCopilot: Accept Ghost Text** - Accept current suggestion (`Tab`)
- **xCopilot: Reject Ghost Text** - Dismiss suggestion (`Esc`)

## 🔧 Technical Details

### AI-Powered Analysis
- **Semantic code analysis** determines context and intent
- **Function scope detection** for relevant suggestions
- **Variable and import analysis** for contextual completions
- **Language-specific patterns** for better accuracy

### Performance Optimization
- **Debounced requests** prevent excessive API calls
- **Contextual throttling** based on typing patterns  
- **Smart caching** reduces response times
- **Efficient rendering** with minimal UI impact

### Integration
- **Works alongside** inline completion for comprehensive suggestions
- **Respects VS Code themes** for consistent appearance
- **Compatible with** existing extensions and workflows

## 🐛 Troubleshooting

### Ghost Text Not Appearing?
1. Check that ghost text is enabled: `Ctrl+Alt+G`
2. Verify backend is running on `localhost:3000`
3. Ensure you're at the end of a line or in whitespace
4. Check VS Code Output panel for xCopilot logs

### Suggestions Not Relevant?
1. Try typing more context before pausing
2. Ensure you're in a supported file type
3. Check that ranking is enabled in settings
4. Verify backend AI service is responding

### Performance Issues?
1. Increase `debounceMs` setting for slower typing
2. Reduce `maxLines` for simpler suggestions
3. Disable `showPreview` to reduce processing
4. Check network connection to backend

## 🎯 Examples

### JavaScript/TypeScript
```javascript
// Type: "function fetchUser(id) {"
// Ghost text: suggests complete async function body

// Type: "const users = data.filter("
// Ghost text: suggests filter predicate
```

### Python
```python
# Type: "def process_data(df):"
# Ghost text: suggests pandas processing steps

# Type: "for item in items:"
# Ghost text: suggests loop body
```

### Java/C#
```java
// Type: "public class UserService {"
// Ghost text: suggests class structure with methods

// Type: "if (user != null && "
// Ghost text: suggests condition completion
```

## 🔗 Backend Setup

Ensure your xCopilot backend is running:
```bash
cd backend
npm install
npm start
```

The ghost text service will connect to: `http://localhost:3000/openai`

---

**🎉 Enjoy intelligent coding with xCopilot's ghost text suggestions!**

> **Note**: Ghost text suggestions work best with a running backend and internet connection for AI processing. Fallback patterns are available for offline scenarios.