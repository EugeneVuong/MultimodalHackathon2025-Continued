from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.tools import tool
from langchain_together import ChatTogether
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
import getpass
import os
import deeplake
import requests
import firebase_admin
from firebase_admin import credentials, firestore

app = FastAPI()

cred = credentials.Certificate("mmh2025-f6143-firebase-adminsdk-fbsvc-898695a57c.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Add CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model outside of endpoint to reuse
model = ChatTogether(
    model="mistralai/Mixtral-8x7B-Instruct-v0.1",
    temperature=0.7,
    api_key="257203c442a94c07ff6f1776f8cfbc6ea6a291cd9404e6fe70ad467cb9342762"
)

# Updated prompt with clear instructions
prompt = ChatPromptTemplate.from_messages([
    (
        "system", 
        """You are a helpful assistant.
           Use the query_dataset tool to search the database and return the top 3 most relevant results.
           **Call the tool only once and do not make additional tool calls after getting the results.**
           After retrieving the results, provide a concise summary that contextualizes these results.
           Do not try to search for more information or make follow-up queries.
        """
    ),
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),
])

def generate_text_embedding(text, api_key="257203c442a94c07ff6f1776f8cfbc6ea6a291cd9404e6fe70ad467cb9342762"):
    """
    Generate text embeddings using Together AI API.
    """
    url = "https://api.together.xyz/v1/embeddings"
    payload = {
        "model": "togethercomputer/m2-bert-80M-8k-retrieval",
        "input": text
    }
    headers = {
        "accept": "application/json",
        "content-type": "application/json", 
        "Authorization": f"Bearer {api_key}"
    }
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        return response.json()['data'][0]['embedding']
    else:
        raise Exception(f"API request failed with status {response.status_code}")

class QueryInput(BaseModel):
    query: str

@tool(args_schema=QueryInput)
def query_dataset(query: str):
    """
    Search the database for the top 3 results based on cosine similarity.
    """
    ds = deeplake.open("file://database")
    embed_query = generate_text_embedding(query)
    str_query = ",".join(str(c) for c in embed_query)

    query_vs = f"""
        SELECT *, cosine_similarity(embedding, ARRAY[{str_query}]) as score
        FROM (
            SELECT *, ROW_NUMBER() AS row_id
        )
        ORDER BY cosine_similarity(embedding, ARRAY[{str_query}]) DESC 
        LIMIT 3
    """
    view_vs = ds.query(query_vs)
    print("test")
    info = ""
    database = []
    for row in view_vs:
        info += f"Camera System [{row['streamId']}]: {row['caption']}\n"

        database.append(row['base64encoding'])
    # Export results to text file
    # with open('results.txt', 'w') as f:
    #     f.write(database[0])
    return info

tools = [query_dataset]

# Create the agent and limit it to a single tool call by setting max_iterations=1.
agent = create_tool_calling_agent(model, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)

class Query(BaseModel):
    query: str

@app.post("/search")
async def search(query: Query):
    try:
        result = agent_executor.invoke({"input": query.query})
        return {"result": result}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
