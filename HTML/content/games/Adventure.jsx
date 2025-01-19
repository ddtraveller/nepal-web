const storyTemplates = {
  himalayan: {
    name: "Himalayan Adventure",
    description: "Explore the mystical peaks and ancient monasteries of the Himalayas"
  },
  fantasy: {
    name: "Fantasy Quest",
    description: "Embark on a magical journey in a world of wonder"
  },
  scifi: {
    name: "Sci-Fi Expedition",
    description: "Venture into the unknown reaches of space and time"
  },
  spiritual: {
    name: "Spiritual Journey",
    description: "Experience profound revelations and inner awakening"
  }
};

const LAMBDA_URL = 'https://zuqaonnjhyobeljlum4m6gclae0gdxsp.lambda-url.us-west-2.on.aws/';

function Adventure() {
  const [storyHistory, setStoryHistory] = React.useState([]);
  const [currentInput, setCurrentInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [selectedType, setSelectedType] = React.useState('himalayan');
  const [sessionId, setSessionId] = React.useState(null);

  React.useEffect(() => {
    setSessionId(`story-${Date.now()}`);
  }, []);

  const startNewStory = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          action: 'start_new',
          story_type: selectedType
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setStoryHistory([{
        text: data.text,
        nepaliText: data.nepaliText,
        image: data.image
      }]);
    } catch (err) {
      setError(`Failed to start story: ${err.message}`);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentInput.trim() || isLoading || !sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          action: 'continue',
          input: currentInput,
          story_type: selectedType
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setStoryHistory(prev => [...prev, {
        text: data.text,
        nepaliText: data.nepaliText,
        image: data.image,
        input: data.input,
        nepaliInput: data.nepaliInput
      }]);
      setCurrentInput('');
    } catch (err) {
      setError(`Failed to continue story: ${err.message}`);
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h1 className="title">An Interactive Adventure Story</h1>
          
          <div className="subtitle">
            <p>Welcome to an AI-powered interactive story experience in English and Nepali!</p>
            <p>Each scene presents you with choices. Type what you would like to do to continue the story.</p>
            <p>The AI will generate unique scenes and images based on your decisions.</p>
          </div>

          <div className="flex flex-col items-center mb-4">
            <label className="subtitle">Choose Your Adventure Type:</label>
            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="select"
              disabled={isLoading}
            >
              {Object.entries(storyTemplates).map(([type, details]) => (
                <option key={type} value={type}>
                  {details.name} - {details.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card-content">
          {error && (
            <div className="error">{error}</div>
          )}

          {isLoading && storyHistory.length === 0 ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p className="subtitle">Preparing your adventure...</p>
            </div>
          ) : (
            <>
              {storyHistory.map((entry, index) => (
                <div key={index} className="story-entry">
                  {entry.image && (
                    <img
                      src={entry.image}
                      alt={`Story scene ${index + 1}`}
                      className="story-image"
                    />
                  )}

                  {entry.input && (
                    <div>
                      <p className="story-action">
                        Your action: {entry.input}
                      </p>
                      {entry.nepaliInput && (
                        <div className="translation-container">
                          <div className="translation-label">
                            तपाईंको कार्य:
                          </div>
                          <div className="translation-text">
                            {entry.nepaliInput}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p>{entry.text}</p>

                  {entry.nepaliText && (
                    <div className="translation-container">
                      <div className="translation-label">
                        नेपाली अनुवाद:
                      </div>
                      <div className="translation-text">
                        {entry.nepaliText}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder="What would you like to do?"
                  className="input"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="button"
                >
                  {isLoading ? 'Generating...' : 'Continue'}
                </button>
              </form>

              <button
                onClick={startNewStory}
                disabled={isLoading}
                className="button secondary"
              >
                Start New Story
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}