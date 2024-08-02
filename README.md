# Multiplayer Random Dot Motion
Creator: Luke Russell\

Purpose: Invesitgation into team Scheduling and team behaviour 

## Startup Instructions
Start the server using the command:
```
npx ts-node server.ts
```
- Introduction can be skipped by setting the skipIntro variable to TRUE
- Use this with the skipToBlock function to skip to a specific stage, either "practice" or "game"
- skipToBlock takes second command for the block, either "sep" where each player is on their own, or "collab" for them to play together. 
## FIle Structure 
### WWW
Contains all client side code, including RDK images, forms (i.e., consent, instructions), JS (game class), main.js (main js file for introductory instructions and initialising game class)
### Data
All data is written here. Is written in a JSON format. dataClean.R is an r file used to clean the data from it's JSON format to a CSV format. Will output a csv in the cleanedData file. This file requires both "rjson" and "dplyr" to be installed, and should run without 
changing any file paths. 