import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Clock, ArrowRight } from 'lucide-react';

const Adventure = () => {
  // State management
  const [locations, setLocations] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [story, setStory] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [currentLocation, setCurrentLocation] = useState('swayambhu_stupa');
  const [storyHistory, setStoryHistory] = useState([]);
  const [image, setImage] = useState(null);
  
  const sessionId = useMemo(() => `session-${Date.now()}`, []);
  const STORY_LAMBDA_URL = 'https://hutcbbitwm5yzzth6lgbeamzuq0eaxjj.lambda-url.us-west-2.on.aws/';
  
  // Make request to Lambda function
  const makeRequest = async (payload) => {
    const response = await fetch(STORY_LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const responseText = await response.text();
    if (!responseText) throw new Error('Empty response from server');
    return JSON.parse(responseText);
  };

  // Load locations data when component mounts
  useEffect(() => {
    const loadLocations = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('https://nepal-web.s3.us-west-2.amazonaws.com/games/public/locations.json');
        if (!response.ok) throw new Error('Failed to load locations');
        const data = await response.json();
        setLocations(data.locations);
        await startNewStory(data.locations);
      } catch (err) {
        setError('Failed to load game data. Please try refreshing the page.');
        console.error('Error loading locations:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadLocations();
  }, []);

  // Calculate travel time between locations
  const calculateTravelTime = (from, to) => {
    if (!locations) return 0;
    const fromCoord = locations[from].coordinates;
    const toCoord = locations[to].coordinates;
    const distance = Math.sqrt(
      Math.pow(fromCoord.x - toCoord.x, 2) + 
      Math.pow(fromCoord.y - toCoord.y, 2)
    );
    return Math.ceil(distance / 10) * 5;
  };

  // Handle user input submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    try {
      setIsLoading(true);
      const data = await makeRequest({
        action: 'continue',
        session_id: sessionId,
        input: input.trim(),
        location: locations[currentLocation].name,
        story_type: 'fantasy'
      });

      if (data?.response) {
        const newText = data.response.text || '';
        setStory(prev => `${prev}\n\nYou: ${input}\n\n${newText}`);
        if (data.response.image) {
          setImage(data.response.image);
        }
      }
      
      setStoryHistory(prev => [...prev, { 
        type: 'action', 
        text: input,
        location: currentLocation 
      }]);
      
      setInput('');
    } catch (error) {
      setError('Failed to process your action. Please try again.');
      console.error('Action error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle travel between locations
  const handleTravel = async (destinationId) => {
    if (!locations || !destinationId || isLoading) return;

    try {
      setIsLoading(true);
      const destination = locations[destinationId];
      const travelTime = calculateTravelTime(currentLocation, destinationId);
      const travelAction = `I want to travel to ${destination.name}`;

      console.log('Sending travel request:', {
        action: 'continue',
        session_id: sessionId,
        input: travelAction,
        location: destination.name
      });
      
      // First make the request to the story generation service
      const data = await makeRequest({
        action: 'continue',
        session_id: sessionId,
        input: travelAction,
        location: destination.name,
        story_type: 'fantasy',
        location_description: destination.description
      });

      console.log('Received response:', data);

      // Only update the UI if we got a successful response
      if (data?.response) {
        // Update the story text
        const newText = data.response.text || '';
        setStory(prev => `${prev}\n\nYou: ${travelAction}\n\n${newText}`);
        
        // Update the image if one was returned
        if (data.response.image) {
          setImage(data.response.image);
        }

        // Only after successful story generation, update the location and history
        setStoryHistory(prev => [...prev, { 
          type: 'travel',
          from: currentLocation,
          to: destinationId,
          time: travelTime
        }]);
        
        setCurrentLocation(destinationId);
      } else {
        throw new Error('No response data from story generation service');
      }
    } catch (error) {
      setError('Failed to travel to the new location. Please try again.');
      console.error('Travel error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Start a new story
  const startNewStory = async (locationData) => {
    try {
      setIsLoading(true);
      const location = locationData[currentLocation];
      
      const data = await makeRequest({
        action: 'start_new',
        session_id: sessionId,
        story_type: 'fantasy',
        location: location.name,
        location_description: location.description
      });

      if (data?.response) {
        const newText = data.response.text || '';
        setStory(newText);
        if (data.response.image) {
          setImage(data.response.image);
        }
      }

      setStoryHistory([]);
    } catch (error) {
      setError('Failed to start a new story. Please try refreshing the page.');
      console.error('Start story error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoading && !story) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading your adventure...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-xl">{error}</div>
      </div>
    );
  }

  // Get available destinations for current location
  const availableDestinations = locations?.[currentLocation]?.connections || [];

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold text-center">Magical Kathmandu Adventure</h1>
      
      {image && (
        <div className="w-full">
          <img 
            src={image} 
            alt="Story scene" 
            className="w-full max-h-96 object-contain rounded shadow"
          />
        </div>
      )}

      <div className="bg-white p-4 rounded shadow whitespace-pre-wrap">
        {story}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-4">
        <input
          type="text"
          className="flex-1 p-2 border rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What would you like to do?"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? "Processing..." : "Submit"}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Current Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="text-xl font-bold mb-2">{locations?.[currentLocation]?.name}</h3>
            <p className="text-gray-600">{locations?.[currentLocation]?.description}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Available Destinations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availableDestinations.map(locationId => (
                <div 
                  key={locationId} 
                  className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                >
                  <div>
                    <h4 className="font-medium">{locations[locationId].name}</h4>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      {calculateTravelTime(currentLocation, locationId)} minutes
                    </div>
                  </div>
                  <button
                    onClick={() => handleTravel(locationId)}
                    disabled={isLoading}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-300"
                  >
                    Travel
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <button 
        onClick={() => startNewStory(locations)}
        className="w-full bg-purple-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
        disabled={isLoading}
      >
        Start New Story
      </button>
    </div>
  );
};

export default Adventure;