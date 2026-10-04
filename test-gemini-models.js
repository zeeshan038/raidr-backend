import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
if (!apiKey) {
  console.log("No API key found in env.");
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

fetch(url)
  .then(r => r.json())
  .then(data => {
    if (data.models) {
      const imagenModels = data.models.filter(m => m.name.includes('image') || m.name.includes('imagen') || m.name.includes('generate'));
      console.log("Available Image/Generation Models:");
      imagenModels.forEach(m => console.log(`- ${m.name} (Methods: ${m.supportedGenerationMethods.join(', ')})`));
    } else {
      console.log("Error or no models:", data);
    }
  })
  .catch(console.error);
