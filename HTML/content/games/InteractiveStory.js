import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const STORY_TEMPLATES = [
  {
    type: "himalayan",
    settings: [
      "remote mountain pass overlooking snow-capped peaks",
      "ancient Buddhist monastery perched on a cliff",
      "hidden Himalayan valley shrouded in mist",
      "traditional Nepalese village nestled in the mountains"
    ],
    elements: [
      "prayer flags fluttering in the wind",
      "ancient carved mani stones",
      "snow leopard tracks in the fresh snow",
      "sound of distant temple bells",
      "scent of burning juniper incense"
    ],
    situations: [
      "meet a wise sherpa with an intriguing proposition",
      "discover mysterious footprints leading off the main trail",
      "witness an unexplainable phenomenon in the mountains",
      "find traces of a lost expedition"
    ]
  },
  {
    type: "fantasy",
    settings: [
      "enchanted forest glowing with magical light",
      "ancient wizard's tower floating in the sky",
      "mystical underground cavern filled with crystals",
      "magical library where books fly"
    ],
    elements: [
      "glowing magical runes",
      "mysterious portals swirling with energy",
      "ethereal creatures of light",
      "ancient magical artifacts",
      "floating orbs of magical energy"
    ],
    situations: [
      "stumble upon a magical ritual in progress",
      "find an ancient prophecy with your name",
      "witness a conflict between magical beings",
      "discover a powerful artifact awakening"
    ]
  },
  {
    type: "scifi",
    settings: [
      "abandoned space station drifting in the void",
      "quantum research facility on a distant planet",
      "alien archaeological site on an asteroid",
      "terraforming colony on the edge of known space"
    ],
    elements: [
      "holographic displays flickering with data",
      "mysterious alien technology pulsing with energy",
      "experimental quantum devices",
      "advanced AI interfaces",
      "temporal anomalies bending space-time"
    ],
    situations: [
      "detect an unknown signal from deep space",
      "discover signs of advanced alien civilization",
      "witness a malfunction in the space-time continuum",
      "find evidence of a scientific breakthrough"
    ]
  },
  {
    type: "spiritual",
    settings: [
      "ancient meditation temple beyond time",
      "interdimensional nexus of consciousness",
      "sacred garden of enlightenment",
      "crystal temple of higher dimensions"
    ],
    elements: [
      "swirling energy vortexes",
      "crystalline thought forms",
      "geometric patterns of pure light",
      "ethereal beings of pure consciousness",
      "vibrating frequencies of reality"
    ],
    situations: [
      "experience a profound spiritual awakening",
      "encounter beings from higher dimensions",
      "discover ancient wisdom teachings",
      "witness the interconnectedness of all things"
    ]
  }
];

const InteractiveStory = () => {
  const [storyHistory, setStoryHistory] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
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
        setHuggingFaceKey(keys.huggingFaceKey);
        setStabilityKey(keys.stabilityKey);
        startNewStory();
      } catch (error) {
        console.error('Error initializing keys:', error);
        setError('Failed to initialize API keys. Please refresh the page.');
      }
    };

    initializeKeys();
  }, []);

  const translateToNepali = async (text) => {
    try {
      const response = await fetch('https://api-inference.huggingface.co/models/facebook/mbart-large-50-many-to-many-mmt', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${huggingFaceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            src_lang: "en_XX",
            tgt_lang: "ne_NP"
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const result = await response.json();
      return result[0]?.translation_text || text;
    } catch (error) {
      console.error('Translation error:', error);
      return '(Translation failed)';
    }
  };

  const buildStoryContext = (history) => {
    if (history.length === 0) return '';
    
    return history.map((entry, index) => {
      if (entry.type === 'story') {
        return `Scene ${index + 1}: ${entry.content}`;
      } else {
        return `Your choice: ${entry.content}`;
      }
    }).join('\n\n');
  };

  const generateStoryText = async (prompt, context = '') => {
    try {
      const fullPrompt = context ? 
        `You are a creative storyteller narrating an interactive story.
         
         Previous story context:
         ${context}
         
         Based on this context:
         ${prompt}
         
         Requirements:
         - Maintain consistency with previous events and character choices
         - Reference past decisions when relevant
         - Keep the same tone and style
         - End with "Choice A:" and "Choice B:" that reflect meaningful decisions
         - Write a complete scene in 60-80 words
         
         Response:` 
        : prompt;

      const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${huggingFaceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: fullPrompt,
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
        throw new Error(`Story generation failed: ${response.status}`);
      }

      const result = await response.json();
      let generatedText = Array.isArray(result) ? result[0].generated_text : result.generated_text;
      
      // Clean up the text
      const cleanupPrompts = [
        "You are a creative storyteller",
        "Previous story context:",
        "Based on this context:",
        "Requirements:",
        "Response:"
      ];
      
      for (const prompt of cleanupPrompts) {
        if (generatedText.includes(prompt)) {
          const parts = generatedText.split(prompt);
          generatedText = parts[parts.length - 1].trim();
        }
      }

      // Get Nepali translation
      const nepaliText = await translateToNepali(generatedText);

      return {
        english: generatedText,
        nepali: nepaliText
      };
    } catch (error) {
      console.error('Error generating story:', error);
      throw new Error('Failed to generate story text');
    }
  };

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
          text_prompts: [{ text: prompt, weight: 1 }],
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
      const template = STORY_TEMPLATES[Math.floor(Math.random() * STORY_TEMPLATES.length)];
      const setting = template.settings[Math.floor(Math.random() * template.settings.length)];
      const situation = template.situations[Math.floor(Math.random() * template.situations.length)];
      const shuffledElements = [...template.elements].sort(() => 0.5 - Math.random());
      const selectedElements = shuffledElements.slice(0, 2 + Math.floor(Math.random() * 2));

      const initialPrompt = `Create an immersive story opener in second-person perspective ("you") with 6th grade level English. 
      The scene takes place in a ${setting} where you ${situation}. 
      Include vivid details about ${selectedElements.join(' and ')}. 
      Write 100-150 words.

      Your story MUST end with a clear question presenting two distinct options for the reader.
      Keep everything in second-person perspective with rich sensory details.

      ### Response:`;
      
      const storyText = await generateStoryText(initialPrompt);
      const imagePrompt = `Fantasy scene, digital art style: ${storyText.english.slice(0, 200)}`;
      const imageUrl = await generateImage(imagePrompt);
      
      setCurrentImage(imageUrl);
      setStoryHistory([{
        type: 'story',
        content: storyText.english,
        nepaliContent: storyText.nepali,
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
      const userActionNepali = await translateToNepali(userAction);
      const newHistory = [
        ...storyHistory,
        { 
          type: 'user', 
          content: userAction,
          nepaliContent: userActionNepali,
          timestamp: new Date().toISOString() 
        }
      ];
      setStoryHistory(newHistory);

      const context = buildStoryContext(storyHistory);
      const prompt = `Continue the story with 6th grade level English based on this action: "${userAction}"
        Create a vivid scene that follows naturally from this choice. 
        Keep everything in second-person perspective ("you") with rich sensory details.
        ### Response:`;

      const newStoryText = await generateStoryText(prompt, context);
      const imagePrompt = `Fantasy scene, digital art style: ${newStoryText.english.slice(0, 200)}`;
      const imageUrl = await generateImage(imagePrompt);
      
      setCurrentImage(imageUrl);
      setStoryHistory([
        ...newHistory,
        { 
          type: 'story', 
          content: newStoryText.english,
          nepaliContent: newStoryText.nepali,
          timestamp: new Date().toISOString() 
        }
      ]);
    } catch (err) {
      setError('Failed to continue story. Please try again.');
      console.error('Error continuing story:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const StoryEntry = ({ entry }) => (
    <div className={`p-4 rounded-lg ${
      entry.type === 'story' 
        ? 'bg-white shadow' 
        : 'bg-blue-50 ml-8'
    }`}>
      <div className="text-sm text-gray-500 mb-2">
        {new Date(entry.timestamp).toLocaleTimeString()}
      </div>
      <div className="space-y-4">
        <div className="whitespace-pre-line">
          {entry.content}
        </div>
        <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
          <div className="text-sm font-medium text-gray-500 mb-1">नेपाली अनुवाद:</div>
          <div className="whitespace-pre-line font-nepali">
            {entry.nepaliContent}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Interactive AI Storyteller
        </CardTitle>
        <CardDescription className="text-center">
          Embark on an AI-generated adventure in English and Nepali
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
              <StoryEntry key={index} entry={entry} />
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