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
  
  const sessionId = useMemo(() => `session-${Date.now()}`, []);
  
  // Load locations data when component mounts
  useEffect(() => {
    const loadLocations = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('https://nepal-web.s3.us-west-2.amazonaws.com/games/public/locations.json');
        if (!response.ok) throw new Error('Failed to load locations');
        const data = await response.json();
        setLocations(data.locations);
        // Start new story after locations are loaded
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
      const newStoryText = `You decided to ${input}...`;
      
      setStoryHistory(prev => [...prev, { 
        type: 'action', 
        text: input,
        location: currentLocation 
      }]);
      
      setStory(prev => `${prev}\n\n${newStoryText}`);
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
      const travelText = `You travel to ${destination.name}. The journey takes ${travelTime} minutes.`;
      
      setStoryHistory(prev => [...prev, { 
        type: 'travel',
        from: currentLocation,
        to: destinationId,
        time: travelTime
      }]);
      
      setCurrentLocation(destinationId);
      setStory(prev => `${prev}\n\n${travelText}\n\n${destination.description}`);
    } catch (error) {
      setError('Failed to travel to the new location. Please try again.');
      console.error('Travel error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Start a new story
  const startNewStory = async (locationData, startLocation) => {
      try {
          setIsLoading(true);
          const locationToUse = startLocation || currentLocation;
          const location = locationData[locationToUse];
          
          const data = await makeRequest({
              action: 'start_new',
              session_id: sessionId,
              story_type: 'fantasy',
              location: location.name,
              location_description: location.description,
              prompt_instructions: `CRITICAL INSTRUCTION: The story MUST begin DIRECTLY in the Eternal Snow Realm. 
  
  Describe the opening scene in vivid detail:
  - Location: Eternal Snow Realm - A mystical dimension where time stands still
  - Initial scene: Capture the unique characteristics of snow spirits weaving intricate patterns of frost and memory
  - Atmosphere: Emphasize the timeless, magical nature of this realm
  - Protagonist: Introduce a character who finds themselves in this extraordinary, frozen dimension
  
  The first paragraph MUST immerse the reader in the Eternal Snow Realm, showcasing its mystical and otherworldly essence.`
          });
  
          if (data?.response) {
              const newText = data.response.text || 
                  (typeof data.response === 'string' ? data.response : '');
              
              setStory(newText);
              
              if (data.response.image) {
                  setImage(data.response.image);
              }
          }
      } catch (error) {
          console.error('Start story error:', error);
          setError('Failed to start story');
      } finally {
          setIsLoading(false);
      }
  };
    
              React.useEffect(() => {
                  const loadLocations = async () => {
                      try {
                          setIsLoading(true);
                          console.log('Loading locations...');
                          const response = await fetch('https://nepal-web.s3.us-west-2.amazonaws.com/games/public/locations.json');
                          if (!response.ok) throw new Error('Failed to load locations');
                          
                          const data = await response.json();
                          console.log('Raw locations data:', data);
  
                          if (!data.locations) {
                              throw new Error('Invalid locations data format');
                          }
  
                          // Set locations and select random starting point
                          const startingLocation = selectRandomLocation(data.locations);
                          console.log('Selected starting location:', startingLocation);
                          
                          setLocations(data.locations);
                          setCurrentLocation(startingLocation);
                          await startNewStory(data.locations, startingLocation);
                      } catch (err) {
                          setError('Failed to load game data. Please try refreshing the page.');
                          console.error('Error loading locations:', err);
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
        onClick={() => startNewStory()}
        className="w-full bg-purple-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
        disabled={isLoading}
      >
        Start New Story
      </button>
    </div>
  );
};

export default Adventure;