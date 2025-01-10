from deep_translator import GoogleTranslator
import json
import re
import time

def translate_to_nepali(text):
    """
    Translate text to Nepali using deep_translator library with retry logic
    """
    if not text or text.isspace():
        return ""
        
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            translator = GoogleTranslator(source='en', target='ne')
            translated = translator.translate(text.strip())
            if translated:
                return translated
            else:
                print(f"Empty translation received for: {text}")
                time.sleep(retry_delay)
        except Exception as e:
            print(f"Translation attempt {attempt + 1} failed for text: {text}")
            print(f"Error: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
    
    # If all retries fail, return a formatted version of the English text
    return f"[NE:{text}]"

def parse_herb_data(content):
    """Parse the raw text content into structured herb data"""
    herbs = []
    current_herb = None
    in_constituents = False
    in_actions = False
    in_preparations = False
    
    lines = content.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Check for new herb entry
        if not line.startswith('-') and not line.startswith(' ') and not any(line.startswith(prefix) for prefix in ['Parts Used:', 'Key constituents:', 'Key actions', 'Specific uses:', 'Preparations:', 'Cautions:']):
            if current_herb:
                herbs.append(current_herb)
            current_herb = {
                'name': line,
                'parts_used': '',
                'constituents': [],
                'actions': [],
                'uses': '',
                'preparations': [],
                'cautions': ''
            }
            # Reset section flags
            in_constituents = False
            in_actions = False
            in_preparations = False
            continue
            
        if current_herb:
            if line.startswith('Parts Used:'):
                current_herb['parts_used'] = line.replace('Parts Used:', '').strip()
                in_constituents = False
                in_actions = False
                in_preparations = False
            elif line.startswith('Key constituents:'):
                in_constituents = True
                in_actions = False
                in_preparations = False
            elif line.startswith('Key actions'):
                in_constituents = False
                in_actions = True
                in_preparations = False
            elif line.startswith('Specific uses:'):
                current_herb['uses'] = line.replace('Specific uses:', '').strip()
                in_constituents = False
                in_actions = False
                in_preparations = False
            elif line.startswith('Preparations:'):
                in_constituents = False
                in_actions = False
                in_preparations = True
            elif line.startswith('Cautions:'):
                current_herb['cautions'] = line.replace('Cautions:', '').strip()
                in_constituents = False
                in_actions = False
                in_preparations = False
            elif line.startswith('-'):
                line = line.replace('-', '').strip()
                if in_constituents:
                    current_herb['constituents'].append(line)
                elif in_actions:
                    current_herb['actions'].append(line)
                elif in_preparations:
                    current_herb['preparations'].append(line)
                    
    # Add the last herb
    if current_herb:
        herbs.append(current_herb)
        
    return herbs

def generate_html(herbs):
    """Generate bilingual HTML document from herb data"""
    
    html_template = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Herbal Medicine Reference Guide - English & Nepali</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 2rem;
            color: #2d3748;
        }}
        .herb-entry {{
            border-bottom: 1px solid #eee;
            padding: 1rem 0;
            margin-bottom: 2rem;
        }}
        .herb-name {{
            font-weight: bold;
            color: #2c5282;
            font-size: 1.2rem;
            margin-bottom: 1rem;
            background: #f7fafc;
            padding: 0.5rem;
            border-radius: 4px;
        }}
        .bilingual {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 1rem;
        }}
        .english {{
            border-right: 1px solid #eee;
            padding-right: 1rem;
        }}
        .nepali {{
            padding-left: 1rem;
        }}
        ul {{
            margin: 0;
            padding-left: 1.2rem;
        }}
    </style>
</head>
<body>
    <h1>Complete Herbal Medicine Reference Guide<br>{title_ne}</h1>
'''

    herb_template = '''
    <div class="herb-entry">
        <div class="herb-name">
            <div class="bilingual">
                <div class="english">{name_en}</div>
                <div class="nepali">{name_ne}</div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Parts Used:</strong> {parts_en}
                </div>
                <div class="nepali">
                    <strong>प्रयोग गरिने भागहरू:</strong> {parts_ne}
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Key constituents:</strong>
                    <ul>
                        {constituents_en}
                    </ul>
                </div>
                <div class="nepali">
                    <strong>मुख्य घटकहरू:</strong>
                    <ul>
                        {constituents_ne}
                    </ul>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Key actions and indications:</strong>
                    <ul>
                        {actions_en}
                    </ul>
                </div>
                <div class="nepali">
                    <strong>मुख्य कार्यहरू र संकेतहरू:</strong>
                    <ul>
                        {actions_ne}
                    </ul>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Specific uses:</strong> {uses_en}
                </div>
                <div class="nepali">
                    <strong>विशिष्ट प्रयोगहरू:</strong> {uses_ne}
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Preparations:</strong>
                    <ul>
                        {preparations_en}
                    </ul>
                </div>
                <div class="nepali">
                    <strong>तयारी विधिहरू:</strong>
                    <ul>
                        {preparations_ne}
                    </ul>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Cautions:</strong> {cautions_en}
                </div>
                <div class="nepali">
                    <strong>सावधानीहरू:</strong> {cautions_ne}
                </div>
            </div>
        </div>
    </div>
'''

    herb_template = """
    <div class="herb-entry">
        <div class="herb-name">
            <div class="bilingual">
                <div class="english">{name_en}</div>
                <div class="nepali">{name_ne}</div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Parts Used:</strong> {parts_en}
                </div>
                <div class="nepali">
                    <strong>प्रयोग गरिने भागहरू:</strong> {parts_ne}
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Key constituents:</strong>
                    <ul>
                        {constituents_en}
                    </ul>
                </div>
                <div class="nepali">
                    <strong>मुख्य घटकहरू:</strong>
                    <ul>
                        {constituents_ne}
                    </ul>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Key actions and indications:</strong>
                    <ul>
                        {actions_en}
                    </ul>
                </div>
                <div class="nepali">
                    <strong>मुख्य कार्यहरू र संकेतहरू:</strong>
                    <ul>
                        {actions_ne}
                    </ul>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Specific uses:</strong> {uses_en}
                </div>
                <div class="nepali">
                    <strong>विशिष्ट प्रयोगहरू:</strong> {uses_ne}
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Preparations:</strong>
                    <ul>
                        {preparations_en}
                    </ul>
                </div>
                <div class="nepali">
                    <strong>तयारी विधिहरू:</strong>
                    <ul>
                        {preparations_ne}
                    </ul>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="bilingual">
                <div class="english">
                    <strong>Cautions:</strong> {cautions_en}
                </div>
                <div class="nepali">
                    <strong>सावधानीहरू:</strong> {cautions_ne}
                </div>
            </div>
        </div>
    </div>
"""

    # Start with the HTML template
    html = html_template.format(
        title_ne=translate_to_nepali("Complete Herbal Medicine Reference Guide")
    )

    # Process each herb
    for herb in herbs:
        # Translate all components
        name_ne = translate_to_nepali(herb['name'])
        parts_ne = translate_to_nepali(herb['parts_used'])
        constituents_ne = [translate_to_nepali(c) for c in herb['constituents']]
        actions_ne = [translate_to_nepali(a) for a in herb['actions']]
        uses_ne = translate_to_nepali(herb['uses'])
        preparations_ne = [translate_to_nepali(p) for p in herb['preparations']]
        cautions_ne = translate_to_nepali(herb['cautions'])

        # Format lists as HTML
        constituents_en = '\n'.join([f'<li>{c}</li>' for c in herb['constituents']])
        constituents_ne = '\n'.join([f'<li>{c}</li>' for c in constituents_ne])
        actions_en = '\n'.join([f'<li>{a}</li>' for a in herb['actions']])
        actions_ne = '\n'.join([f'<li>{a}</li>' for a in actions_ne])
        preparations_en = '\n'.join([f'<li>{p}</li>' for p in herb['preparations']])
        preparations_ne = '\n'.join([f'<li>{p}</li>' for p in preparations_ne])

        # Add herb section to HTML
        html += herb_template.format(
            name_en=herb['name'],
            name_ne=name_ne,
            parts_en=herb['parts_used'],
            parts_ne=parts_ne,
            constituents_en=constituents_en,
            constituents_ne=constituents_ne,
            actions_en=actions_en,
            actions_ne=actions_ne,
            uses_en=herb['uses'],
            uses_ne=uses_ne,
            preparations_en=preparations_en,
            preparations_ne=preparations_ne,
            cautions_en=herb['cautions'],
            cautions_ne=cautions_ne
        )

    html += "\n</body>\n</html>"
    return html

def main():
    # Read input file
    with open('herbs.txt', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Parse herbs data
    herbs = parse_herb_data(content)
    
    # Generate HTML
    html = generate_html(herbs)
    
    # Write output file
    with open('herbal_guide.html', 'w', encoding='utf-8') as f:
        f.write(html)

if __name__ == "__main__":
    main()