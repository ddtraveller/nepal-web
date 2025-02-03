import yt_dlp
import os
import tempfile

if __name__ == '__main__':
    video_url = input("Enter the URL of the YouTube video you want to transcribe: ")
    cookie_value = input("Enter your YouTube cookie string: ")
    
    # Create a temporary cookie file
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
        f.write("# Netscape HTTP Cookie File\n")
        f.write(".youtube.com\tTRUE\t/\tTRUE\t2999999999\tCONSENT\tYES+1\n")
        f.write(f".youtube.com\tTRUE\t/\tTRUE\t2999999999\tYOUTUBE_VISITOR_DATA\t{cookie_value}\n")
        cookie_file = f.name
    
    ydl_opts = {
        'skip_download': True,
        'writesubtitles': True,
        'subtitleslangs': ['en'],
        'subtitlesformat': 'vtt',
        'cookiesfile': cookie_file,
        'outtmpl': '%(title)s.%(ext)s',
        'noplaylist': True
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract video info
            info_dict = ydl.extract_info(video_url, download=False)
            video_title = info_dict.get('title', None)
            
            # Download only subtitles
            print(f"Getting subtitles for: {video_title}")
            ydl.download([video_url])
            
            # Check if subtitles were downloaded
            subtitle_file = f"{video_title}.en.vtt"
            if os.path.isfile(subtitle_file):
                # Read the subtitle file
                with open(subtitle_file, 'r', encoding='utf-8') as file:
                    subtitles = file.read()
                
                # Remove timestamps and format the transcript
                lines = subtitles.split('\n')
                transcript = []
                for line in lines:
                    if '-->' not in line and line.strip() != '' and not line.strip().isdigit():
                        transcript.append(line.strip())
                
                # Save the transcript to a text file
                transcript_file = "transcript.txt"
                with open(transcript_file, 'w', encoding='utf-8') as file:
                    file.write('\n'.join(transcript))
                
                print(f"Transcript saved to: {transcript_file}")
                
                # Clean up the .vtt file
                os.remove(subtitle_file)
            else:
                print("No subtitles found for the video. Transcript could not be generated.")
                
    except Exception as e:
        print(f"An error occurred: {str(e)}")
    finally:
        # Clean up the temporary cookie file
        if os.path.exists(cookie_file):
            os.remove(cookie_file)