import sys
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory
from langchain.schema import BaseMessage

# Redirect stdout to a file
with open('langchain_docs.txt', 'w') as f:
    sys.stdout = f
    
    print("=== ChatAnthropic Class Documentation ===")
    help(ChatAnthropic)
    
    print("\n=== ChatAnthropic.invoke Documentation ===")
    help(ChatAnthropic.invoke)
    
    print("\n=== BaseMessage Documentation ===")
    help(BaseMessage)
    
    print("\n=== DynamoDBChatMessageHistory Documentation ===")
    help(DynamoDBChatMessageHistory)
    
    print("\n=== SystemMessage Documentation ===")
    help(SystemMessage)
    
    print("\n=== HumanMessage Documentation ===")
    help(HumanMessage)
    
    print("\n=== AIMessage Documentation ===")
    help(AIMessage)

    # Reset stdout
    sys.stdout = sys.__stdout__

print("Documentation has been written to langchain_docs.txt")