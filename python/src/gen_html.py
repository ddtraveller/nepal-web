from anthropic import Anthropic
from deep_translator import GoogleTranslator
from bs4 import BeautifulSoup
import os
from datetime import datetime
import time
import PyPDF2

def extract_relevant_sections(text, topic, max_tokens=50000):
    """Extract relevant sections from PDF content based on the topic."""
    sections = text.split('\n\n')
    keywords = topic.lower().split()
    
    relevant_sections = []
    current_size = 0
    
    for section in sections:
        if len(section.strip()) < 100:
            continue
            
        is_relevant = any(keyword in section.lower() for keyword in keywords)
        
        if is_relevant:
            section_tokens = len(section.split())
            if current_size + section_tokens <= max_tokens:
                relevant_sections.append(section)
                current_size += section_tokens
                
    if current_size < max_tokens / 2:
        for section in sections:
            if any(header in section.lower() for header in ['introduction', 'chapter 1', 'overview', 'fundamentals']):
                if current_size + len(section.split()) <= max_tokens:
                    relevant_sections.append(section)
                    current_size += len(section.split())
                    
    return '\n\n'.join(relevant_sections)

def read_pdf_content(pdf_path):
    try:
        if not pdf_path or pdf_path.lower().strip() == 'none':
            return None
            
        if not os.path.exists(pdf_path):
            print(f"PDF file not found: {pdf_path}")
            return None
            
        print(f"Reading PDF file: {pdf_path}")
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            print(f"Successfully extracted {len(text)} characters from PDF")
            return text
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return None

def get_anthropic_content(topic, pdf_content=None):
    client = Anthropic()
    
    context = ""
    if pdf_content:
        relevant_content = extract_relevant_sections(pdf_content, topic)
        context = f"\nUse this additional context while creating the content (focus on the most relevant parts): {relevant_content}"
    
    prompt = f"""Create a comprehensive HTML page about {topic}. 
    The content should be very detailed and include:
    - A thorough introduction section
    - At least 5-6 major sections
    - Each section should have 2-3 paragraphs of detailed information
    - Include examples where appropriate
    - Include best practices and common use cases
    - Include tips and tricks
    - Include common pitfalls and how to avoid them
    {context}
    
    Use this exact HTML structure for the page:
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>{topic}</title>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; }}
            header {{ background-color: #333; color: #fff; padding: 20px; text-align: center; }}
            main {{ padding: 20px; max-width: 1200px; margin: 0 auto; }}
            section {{ margin-bottom: 40px; border: 1px solid #eee; border-radius: 8px; padding: 20px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
            h2 {{ color: #333; font-size: 24px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #eee; }}
            .content-wrapper {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }}
            .english-content {{ padding: 15px; background: #fff; border-radius: 6px; }}
            .nepali-content {{ padding: 15px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #007bff; }}
            .language-label {{ font-size: 0.8em; color: #666; text-transform: uppercase; margin-bottom: 10px; font-weight: bold; }}
            @media (max-width: 768px) {{ .content-wrapper {{ grid-template-columns: 1fr; }} .english-content, .nepali-content {{ margin-bottom: 20px; }} }}
            ul {{ margin: 0; padding-left: 20px; }}
            li {{ margin-bottom: 8px; }}
            .main-illustration {{ margin: 30px auto; text-align: center; max-width: 800px; background: #f8f9fa; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
            .main-illustration svg {{ max-width: 100%; height: auto; }}
        </style>
    </head>
    <body>
        <header>
            <h1>{topic}</h1>
        </header>
        <!-- Content sections will go here -->
    </body>
    </html>
    
    For each section, use this structure:
    <section id="section-id">
        <h2>Section Title</h2>
        <div class="content-wrapper">
            <div class="english-content">
                <div class="language-label">English</div>
                <!-- English content here -->
            </div>
            <div class="nepali-content">
                <div class="language-label">नेपाली</div>
                <!-- Nepali content will be added here -->
            </div>
        </div>
    </section>
    
    Return only the complete HTML code."""
    
    message = client.messages.create(
        model="claude-3-sonnet-20240229",
        max_tokens=4000,
        temperature=0.7,
        system="You are a helpful assistant that creates comprehensive, well-structured HTML content. Always return valid HTML code.",
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )
    
    content = message.content
    return content[0].text if isinstance(content, list) else str(content)

def chunk_text(text, max_length=4500):
    """Split text into smaller chunks that won't exceed translation limits."""
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0
    
    for word in words:
        if current_length + len(word) + 1 <= max_length:
            current_chunk.append(word)
            current_length += len(word) + 1
        else:
            chunks.append(' '.join(current_chunk))
            current_chunk = [word]
            current_length = len(word) + 1
    
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    return chunks

def translate_to_nepali(text):
    try:
        if not text or not text.strip():
            print("Empty text received for translation")
            return ""
            
        print(f"\nTranslating text of length {len(text)}:")
        chunks = chunk_text(text)
        print(f"Split into {len(chunks)} chunks")
        
        translator = GoogleTranslator(source='en', target='ne')
        translated_chunks = []
        
        for i, chunk in enumerate(chunks, 1):
            try:
                print(f"Translating chunk {i}/{len(chunks)}")
                translated = translator.translate(chunk)
                if translated:
                    translated_chunks.append(translated)
                else:
                    print(f"Warning: Empty translation received for chunk {i}")
                # Add progressive delay to avoid rate limiting
                time.sleep(2 * i)  
            except Exception as chunk_error:
                print(f"Error translating chunk {i}: {str(chunk_error)}")
                translated_chunks.append(f"[Translation Error: {str(chunk_error)}]")
        
        final_translation = ' '.join(translated_chunks)
        print(f"Translation completed, final length: {len(final_translation)}")
        return final_translation
        
    except Exception as e:
        print(f"Translation error: {str(e)}")
        return f"[Translation Error: {str(e)}]"

def process_html_content(html_content):
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        english_divs = soup.find_all('div', class_='english-content')
        
        print(f"\nFound {len(english_divs)} English content sections")
        
        # Collect all English text for the illustration
        all_english_text = ' '.join(' '.join(div.stripped_strings) for div in english_divs)
        
        print("\nGenerating SVG illustration based on all content...")
        svg_content = get_svg_illustration(all_english_text)
        
        # Create a div for the SVG and insert after the header
        svg_div = soup.new_tag('div', attrs={'class': 'main-illustration'})
        svg_div.append(BeautifulSoup(svg_content, 'html.parser'))
        
        header = soup.find('header')
        if header:
            header.insert_after(svg_div)
        
        # Process all sections for translation
        for i, eng_div in enumerate(english_divs, 1):
            print(f"\nProcessing section {i}:")
            
            # Get all text content including list items
            english_text = []
            for elem in eng_div.stripped_strings:
                english_text.append(elem)
            english_text = ' '.join(english_text)
            
            if not english_text:
                print(f"Warning: Empty English text in section {i}")
                continue
                
            print(f"English text found: {english_text[:100]}...")
            
            section = eng_div.find_parent('section')
            if not section:
                print(f"Warning: Could not find parent section for English div {i}")
                continue
                
            section_id = section.get('id', f'section{i}')
            print(f"Section ID: {section_id}")
            
            nepali_div = section.find('div', class_='nepali-content')
            if not nepali_div:
                print(f"Creating missing Nepali div for section {section_id}")
                nepali_div = soup.new_tag('div', attrs={'class': 'nepali-content'})
                eng_div.insert_after(nepali_div)
            
            # Add language label if missing
            if not nepali_div.find('div', class_='language-label'):
                label_div = soup.new_tag('div', attrs={'class': 'language-label'})
                label_div.string = 'नेपाली'
                nepali_div.insert(0, label_div)
            
            nepali_text = translate_to_nepali(english_text)
            if nepali_text and not nepali_text.startswith('[Translation Error:'):
                content_div = soup.new_tag('div')
                content_div.string = nepali_text
                
                # Clear everything except the language label
                label = nepali_div.find('div', class_='language-label')
                nepali_div.clear()
                nepali_div.append(label)
                nepali_div.append(content_div)
                
                print(f"Added translation to Nepali div in section {section_id}")
            else:
                print(f"Translation failed for section {section_id}")
                error_div = soup.new_tag('div')
                error_div.string = nepali_text if nepali_text else "Translation failed"
                nepali_div.append(error_div)
        
        return str(soup)
        
    except Exception as e:
        print(f"Error processing HTML: {e}")
        raise e

def main():
    topic = input("Enter a topic for the content: ")
    pdf_path = input("Enter the path to a PDF file for additional context (or press Enter to skip): ")
    
    if not os.getenv('ANTHROPIC_API_KEY'):
        print("Please set the ANTHROPIC_API_KEY environment variable")
        return
    
    try:
        # Read PDF content if provided
        pdf_content = read_pdf_content(pdf_path) if pdf_path else None
        
        print("Generating comprehensive content with Anthropic...")
        html_content = get_anthropic_content(topic, pdf_content)
        
        if not html_content:
            print("Error: No content received from Anthropic")
            return
            
        print("\nTranslating content to Nepali...")
        final_html = process_html_content(html_content)
        
        # Clean the topic string and ensure it's not too long
        clean_topic = ''.join(e for e in topic if e.isalnum() or e.isspace())
        clean_topic = clean_topic.replace(' ', '_')
        
        # Get timestamp in shorter format (2 digit year, month, day, hour, minute)
        timestamp = datetime.now().strftime("%y%m%d_%H%M")
        
        # Combine topic and timestamp, ensuring total length is no more than 25 chars
        max_topic_length = 25 - len(timestamp) - 1  # -1 for the underscore
        if len(clean_topic) > max_topic_length:
            clean_topic = clean_topic[:max_topic_length]
        
        filename = f"{clean_topic}_{timestamp}.html"
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(final_html)
        
        print(f"\nHTML file has been generated: {filename}")
        print("Please open the file in a web browser to view the results.")
        
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        print("\nFull error details:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()