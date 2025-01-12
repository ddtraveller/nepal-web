import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const STORY_THEMES = {
  scifi: "Science Fiction",
  fantasy: "Fantasy",
  spiritual: "Spiritual"
};

// Story seeds from the sample code
const storySeeds = [
  "A magical library where books write themselves",
  "A city where dreams are traded like currency",
  "A forest where the trees can walk",
  "An ancient spaceship discovered in a desert",
  // ... add more seeds as needed
];

const InteractiveStory = () => {
  const [storyHistory, setStoryHistory] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState('fantasy');
  const [huggingFaceKey, setHuggingFaceKey] = useState(null);
  const [stabilityKey, setStabilityKey] = useState(null);
  const [currentImage, setCurrentImage] = useState('/api/placeholder/600/300');

  // Initialize API keys
  useEffect(() => {
    const initializeKeys = async () => {
      try {
        const response = await fetch('https://zuqaonnjhyobeljlum4m6gclae0gdxsp.lambda-url.us-west-2.on.aws/', {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const keys = await response.json();
        if (!keys.huggingFaceKey || !keys.stabilityKey) {
          throw new Error('Invalid API key data received');
        }

        setHuggingFaceKey(keys.huggingFaceKey);
        setStabilityKey(keys.stabilityKey);
        startNewStory(); // Start story once keys are initialized
      } catch (error) {
        console.error('Error initializing keys:', error);
        setError('Failed to initialize API keys. Please refresh the page.');
      }
    };

    initializeKeys();
  }, []);

  // Generate story text using Hugging Face
  const generateStoryText = async (prompt) => {
    try {
      const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${huggingFaceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 150,
            min_new_tokens: 50,
            temperature: 0.7,
            top_p: 0.9,
            repetition_penalty: 1.1
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
      }

      const result = await response.json();
      let generatedText = Array.isArray(result) ? result[0].generated_text : result.generated_text;
      
      // Clean up the text using the same logic as the sample code
      const storytellerPrompts = [
        "You are a creative storyteller.",
        "Based on this story context:",
        "The reader chooses to:",
        "Continue the story",
        "Requirements:",
        "Response:"
      ];
      
      for (const prompt of storytellerPrompts) {
        if (generatedText.includes(prompt)) {
          const parts = generatedText.split(prompt);
          generatedText = parts[parts.length - 1].trim();
        }
      }

      return generatedText;
    } catch (error) {
      console.error('Error generating story:', error);
      throw new Error('Failed to generate story text');
    }
  };

  // Generate image using Stability AI
  const generateImage = async (prompt) => {
    try {
      const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${stabilityKey}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          text_prompts: [
            {
              text: prompt,
              weight: 1
            }
          ],
          cfg_scale: 7,
          height: 1024,
          width: 1024,
          samples: 1,
          steps: 30,
        })
      });

      if (!response.ok) {
        throw new Error(`Image generation failed: ${response.status}`);
      }

      const result = await response.json();
      return `data:image/png;base64,${result.artifacts[0].base64}`;
    } catch (error) {
      console.error('Error generating image:', error);
      throw new Error('Failed to generate image');
    }
  };

  const startNewStory = async () => {
    if (!huggingFaceKey || !stabilityKey) return;
    
    setIsLoading(true);
    setError(null);
    setStoryHistory([]);

    try {
      // Get a random story seed
      const storySeed = storySeeds[Math.floor(Math.random() * storySeeds.length)];
      
      // Generate initial story
      const initialPrompt = `You are a creative storyteller. Using this story concept as inspiration: "${storySeed}"
      Write a complete scene with beginning and choices in 60 words. Add "Choice A:" and "Choice B:" at the end.`;
      
      const storyText = await generateStoryText(initialPrompt);
      
      // Generate image for the story
      const imagePrompt = `Fantasy scene, digital art style: ${storyText.slice(0, 200)}`;
      const imageUrl = await generateImage(imagePrompt);
      
      setCurrentImage(imageUrl);
      setStoryHistory([{
        type: 'story',
        content: storyText,
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      setError('Failed to start new story. Please try again.');
      console.error('Error starting story:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserInput = async (e) => {
    e.preventDefault();
    if (!currentInput.trim() || !huggingFaceKey || !stabilityKey) return;

    const userAction = currentInput;
    setCurrentInput('');
    setError(null);
    setIsLoading(true);

    try {
      // Add user input to history
      const newHistory = [
        ...storyHistory,
        { type: 'user', content: userAction, timestamp: new Date().toISOString() }
      ];
      setStoryHistory(newHistory);

      // Generate new story segment
      const previousScene = storyHistory[storyHistory.length - 1].content;
      const prompt = `Continue this story based on the user's choice.
      Previous: "${previousScene}"
      Action: "${userAction}"
      Write a complete scene with beginning and choices in 60 words. Add "Choice A:" and "Choice B:" at the end.`;

      const newStoryText = await generateStoryText(prompt);
      
      // Generate new image
      const imagePrompt = `Fantasy scene, digital art style: ${newStoryText.slice(0, 200)}`;
      const imageUrl = await generateImage(imagePrompt);
      
      setCurrentImage(imageUrl);
      setStoryHistory([
        ...newHistory,
        { type: 'story', content: newStoryText, timestamp: new Date().toISOString() }
      ]);
    } catch (err) {
      setError('Failed to continue story. Please try again.');
      console.error('Error continuing story:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Interactive AI Storyteller
        </CardTitle>
        <CardDescription className="text-center">
          Embark on an AI-generated adventure
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <img 
            src={currentImage} 
            alt="Story scene" 
            className="w-full h-64 object-cover rounded-lg"
          />

          <div className="story-history space-y-4 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg">
            {storyHistory.map((entry, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg ${
                  entry.type === 'story' 
                    ? 'bg-white shadow' 
                    : 'bg-blue-50 ml-8'
                }`}
              >
                <div className="text-sm text-gray-500 mb-2">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </div>
                <div className="whitespace-pre-line">
                  {entry.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">
                  {storyHistory.length === 0 ? 'Starting new story...' : 'Generating next scene...'}
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleUserInput} className="flex gap-2">
            <Input
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              placeholder="What would you like to do?"
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={isLoading || !currentInput.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </form>

          <Button 
            onClick={startNewStory} 
            variant="outline"
            disabled={isLoading}
            className="w-full"
          >
            Start New Story
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InteractiveStory;