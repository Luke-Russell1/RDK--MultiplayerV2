library(dplyr)
library(rjson)
# The current file is set up so that it reads and writes fairly independently
# if you want to read and write multiple files, or keep old versions chnage the
# file name of the write.csv function at the end, so it doesn't overwrite
# something that might already be there

for (l in 1:1) {
  ## Setting up pathing
  current_path <- getwd()
  dataPath <- paste(current_path, "/data/", sep = "")
  setwd(dataPath)
  filesInPath <- list.files(dataPath)
  dataFiles <- list()
  ## headers for the dataframes
  headersList <- c(
    "dyad", "block", "trialNo", "player", "rt", "choice", "choiceTime",
    "completionTime", "direction",
    "totalRT", "attempts", "coherence", "timestamp"
  )

  ## Reading in json files from path
  for (i in seq_along(filesInPath)) {
    # Read JSON file
    temp <- fromJSON(file = filesInPath[i])
    dataFiles[[i]] <- temp
  }
  ## initialise empty lists, dyads go in sub lists
  p1DataList <- list()
  p2DataList <- list()

  ## I represents the dyads in the list of datafiles
  for (i in seq_along(dataFiles)) {
    temp <- dataFiles[[i]]
    p1DataList[[i]] <- list()
    p2DataList[[i]] <- list()

    ## j is used for trials for each dyad
    for (j in seq_along(temp)) {
      # Extract trial data
      trial <- temp[[j]]
      p1RDK <- trial$P1RDK
      p2RDK <- trial$P2RDK

      # Convert choices to numeric
      p1choice <- as.numeric(p1RDK$choice) + 1
      p2choice <- as.numeric(p2RDK$choice) + 1

      # Calculate direction indices (1-based index, so adjust as needed)
      p1DirectionIndex <- which(p1RDK$completed)
      p2DirectionIndex <- which(p2RDK$completed)

      # Filter choices based on completed status
      if (length(p1DirectionIndex) > 0) {
        completed_status_p1 <- p1choice %in% p1DirectionIndex
        filtered_p1choice <- p1choice[completed_status_p1]
      } else {
        filtered_p1choice <- numeric(0) # Empty numeric vector if no indices
      }
      if (length(p2DirectionIndex) > 0) {
        completed_status_p2 <- p2choice %in% p2DirectionIndex
        filtered_p2choice <- p1choice[completed_status_p2]
      } else {
        filtered_p2choice <- numeric(0) # Empty numeric vector if no indices
      }
      # Filter indices for choice time, reaction time, etc.
      filter_p1DirectionIndex <- p1DirectionIndex
      filter_p2DirectionIndex <- p2DirectionIndex

      # Extract and filter other vectors
      p1Choicetime <- p1RDK$choiceTime[filter_p1DirectionIndex]
      p2Choicetime <- p2RDK$choiceTime[filter_p2DirectionIndex]
      p1Timestamp <- p1RDK$timeStamp[filter_p1DirectionIndex]
      p2Timestamp <- p2RDK$timeStamp[filter_p2DirectionIndex]
      p1RT <- p1RDK$reactionTime[filter_p1DirectionIndex]
      p2RT <- p2RDK$reactionTime[filter_p2DirectionIndex]
      p1TotalRT <- p1RDK$totalReactionTIme[filter_p1DirectionIndex]
      p2TotalRT <- p2RDK$totalReactionTIme[filter_p2DirectionIndex]

      p1CompletionTime <- if (length(p1RDK$completionTime) > 0) p1RDK$completionTime else 6
      p2CompletionTime <- if (length(p2RDK$completionTime) > 0) p2RDK$completionTime else 6

      p1Direction <- as.factor(p1RDK$direction[filter_p1DirectionIndex])
      p2Direction <- as.factor(p2RDK$direction[filter_p2DirectionIndex])

      p1Attempts <- p1RDK$attempts[filter_p1DirectionIndex]
      p2Attempts <- p2RDK$attempts[filter_p2DirectionIndex]

      p1Coherence <- p1RDK$coherence[filter_p1DirectionIndex]
      p2Coherence <- p2RDK$coherence[filter_p2DirectionIndex]

      p1 <- rep(1, length(filtered_p1choice))
      p2 <- rep(2, length(filtered_p2choice))

      trialNo <- trial$trialNo
      p1CompletionTime <- rep(p1CompletionTime, length(filtered_p1choice))
      p2CompletionTime <- rep(p2CompletionTime, length(filtered_p2choice))
      p1TrialNo <- rep(trialNo, length(filtered_p1choice))
      p2TrialNo <- rep(trialNo, length(filtered_p2choice))

      p1Dyad <- rep(i, length(filtered_p1choice))
      p2Dyad <- rep(i, length(filtered_p2choice))

      p1Block <- rep(trial$block, length(filtered_p1choice))
      p2Block <- rep(trial$block, length(filtered_p2choice))

      # Create data frames only if there are non-zero choices
      if (length(filtered_p1choice) > 0) {
        p1Data <- data.frame(
          p1Dyad, p1Block, p1TrialNo, p1, p1RT, filtered_p1choice, p1Choicetime,
          p1CompletionTime, p1Direction, p1TotalRT, p1Attempts, p1Coherence, p1Timestamp
        )
        colnames(p1Data) <- headersList
      }
      if (length(filtered_p1choice) > 0) {
        p1DataList[[i]][[j]] <- p1Data
      }
      if (length(filtered_p2choice) > 0) {
        p2Data <- data.frame(
          p2Dyad, p2Block, p2TrialNo, p2, p2RT, filtered_p2choice, p2Choicetime,
          p2CompletionTime, p2Direction, p2TotalRT, p2Attempts, p2Coherence
        )
        colnames(p2Data) <- headersList
      }
      if (length(filtered_p2choice) > 0) {
        p2DataList[[i]][[j]] <- p2Data
      }
    }
  }

  ## Collapse individual lists into one big dataframe
  for (i in 1:length(p1DataList)) {
    if (length(p1DataList) > 0) {
      p1DataFrame <- p1DataList[[i]]
    }
    if (length(p2DataList) > 0) {
      p2DataFrame <- p2DataList[[i]]
    }
    if (exists("p2DataFrame") && exists("p1DataFrame")) {
      data <- bind_rows(p1DataFrame, p2DataFrame)
      data2 <- data %>%
        group_by(dyad, block, trialNo) %>%
        arrange(timestamp, .by_group = TRUE)
      rm(list = ls()[!ls() %in% c("data2")])
    } else if (exists("p1DataFrame")) {
      data <- bind_rows(p1DataFrame)
      data2 <- data %>%
        group_by(dyad, block, trialNo) %>%
        arrange(timestamp, .by_group = TRUE)
      rm(list = ls()[!ls() %in% c("data2")])
    } else {
      data <- bind_rows(p2Data)
      data2 <- data %>%
        group_by(dyad, block, trialNo) %>%
        arrange(timestamp, .by_group = TRUE)
      rm(list = ls()[!ls() %in% c("data2")])
    }
  }

  setwd("..")
  current_path <- getwd()
  dataPath <- paste(current_path, "/cleanedData/", sep = "")
  setwd(dataPath)
  write.csv(data2, "RDKData1.csv")
}
