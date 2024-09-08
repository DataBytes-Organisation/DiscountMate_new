import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

const initialDiscussionTopics = [
  {
    id: 1,
    title: "Latest Tech in Supermarkets",
    date: "August 10, 2024",
    description:
      "Discuss the newest technologies being implemented in supermarkets around the world.",
    likes: 12,
    dislikes: 3,
    commentsCount: 2,
    comments: [
      {
        id: 1,
        user: "Techie123",
        comment:
          "It's incredible how AI is being used to manage stock levels now!",
        likes: 5,
        dislikes: 0,
        replies: [],
        image: null,
      },
      {
        id: 2,
        user: "GroceryGuru",
        comment:
          "I saw a robot assisting customers at my local store. The future is here.",
        likes: 7,
        dislikes: 1,
        replies: [],
        image: null,
      },
    ],
  },
  {
    id: 2,
    title: "Budgeting Tips for Families",
    date: "August 9, 2024",
    description:
      "Share your best budgeting tips that help save money for families.",
    likes: 25,
    dislikes: 5,
    commentsCount: 2,
    comments: [
      {
        id: 1,
        user: "SaveMore",
        comment: "Planning meals ahead really helps cut costs!",
        likes: 10,
        dislikes: 2,
        replies: [],
        image: null,
      },
      {
        id: 2,
        user: "FamilyFirst",
        comment: "We started buying in bulk, saves a lot of money.",
        likes: 12,
        dislikes: 1,
        replies: [],
        image: null,
      },
    ],
  },
  {
    id: 3,
    title: "Home Automation Trends",
    date: "September 5, 2024",
    description: "Discuss the latest trends in home automation technology.",
    likes: 30,
    dislikes: 2,
    commentsCount: 4,
    comments: [
      {
        id: 1,
        user: "TechSavvy",
        comment: "Smart lighting has become much more advanced recently.",
        likes: 8,
        dislikes: 0,
        replies: [],
        image: null,
      },
      {
        id: 2,
        user: "HomeGeek",
        comment:
          "I love using voice-controlled assistants for my smart home devices!",
        likes: 10,
        dislikes: 1,
        replies: [],
        image: null,
      },
      {
        id: 3,
        user: "Innovator",
        comment: "AI-powered security systems are becoming the norm.",
        likes: 5,
        dislikes: 2,
        replies: [],
        image: null,
      },
      {
        id: 4,
        user: "GadgetFan",
        comment: "Automated thermostats are helping me save energy!",
        likes: 7,
        dislikes: 1,
        replies: [],
        image: null,
      },
    ],
  },
];

const DiscussionPage = () => {
  const [topics, setTopics] = useState(initialDiscussionTopics);
  const [visibleComments, setVisibleComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [image, setImage] = useState({});
  const [replies, setReplies] = useState({});
  const [commentsShown, setCommentsShown] = useState(2);
  const [sortBy, setSortBy] = useState(null);

  // Toggle visibility of comments
  const toggleComments = (index) => {
    setVisibleComments((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // Handle comment input changes
  const handleCommentChange = (index, value) => {
    setNewComment((prev) => ({ ...prev, [index]: value }));
  };

  // Add new comment to a topic
  const addComment = (index) => {
    if (newComment[index]?.trim() === "") return;

    const updatedTopics = [...topics];
    updatedTopics[index].comments.push({
      id: updatedTopics[index].comments.length + 1,
      user: "NewUser",
      comment: newComment[index],
      likes: 0,
      dislikes: 0,
      replies: [],
      image: image[index] || null,
    });
    updatedTopics[index].commentsCount += 1;
    setTopics(updatedTopics);
    setNewComment((prev) => ({ ...prev, [index]: "" }));
  };

  // Like/dislike post
  const likePost = (index) => {
    const updatedTopics = [...topics];
    updatedTopics[index].likes += 1;
    setTopics(updatedTopics);
  };

  const dislikePost = (index) => {
    const updatedTopics = [...topics];
    updatedTopics[index].dislikes += 1;
    setTopics(updatedTopics);
  };

  // Image picker for comments
  const pickImage = async (index) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.cancelled) {
      setImage((prev) => ({ ...prev, [index]: result.uri }));
    }
  };

  // Reply to a comment
  const replyToComment = (topicIndex, commentId, value) => {
    const updatedTopics = [...topics];
    const commentIndex = updatedTopics[topicIndex].comments.findIndex(
      (comment) => comment.id === commentId
    );

    updatedTopics[topicIndex].comments[commentIndex].replies.push({
      user: "ReplyUser",
      reply: value,
    });
    setReplies((prev) => ({ ...prev, [topicIndex]: "" }));
    setTopics(updatedTopics);
  };

  // Like/dislike comment
  const likeComment = (topicIndex, commentIndex) => {
    const updatedTopics = [...topics];
    updatedTopics[topicIndex].comments[commentIndex].likes += 1;
    setTopics(updatedTopics);
  };

  const dislikeComment = (topicIndex, commentIndex) => {
    const updatedTopics = [...topics];
    updatedTopics[topicIndex].comments[commentIndex].dislikes += 1;
    setTopics(updatedTopics);
  };

  // Sort topics based on likes or comments
  const sortTopics = (sortType) => {
    if (sortBy === sortType) {
      setTopics(initialDiscussionTopics); // Reset to initial order
      setSortBy(null); // Reset sortBy to null
    } else {
      let sortedTopics;
      if (sortType === "likes") {
        sortedTopics = [...topics].sort((a, b) => b.likes - a.likes);
      } else if (sortType === "comments") {
        sortedTopics = [...topics].sort(
          (a, b) => b.commentsCount - a.commentsCount
        );
      }
      setTopics(sortedTopics);
      setSortBy(sortType);
    }
  };

  // Filter and sort topics
  const filteredTopics = topics.filter((topic) =>
    topic.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Discussion Topics</Text>

      {/* Search Bar */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search topics..."
        value={searchTerm}
        onChangeText={(text) => setSearchTerm(text)}
      />

      {/* Sort Buttons */}
      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === "likes" && styles.sortActive]}
          onPress={() => sortTopics("likes")}
        >
          <Text style={styles.buttonText}>Sort by Likes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortButton,
            sortBy === "comments" && styles.sortActive,
          ]}
          onPress={() => sortTopics("comments")}
        >
          <Text style={styles.buttonText}>Sort by Comments</Text>
        </TouchableOpacity>
      </View>

      {filteredTopics.map((topic, index) => (
        <View key={topic.id} style={styles.post}>
          <View style={styles.textContainer}>
            <Text style={styles.postTitle}>{topic.title}</Text>
            <Text style={styles.postDate}>{topic.date}</Text>
            <Text style={styles.postDescription}>{topic.description}</Text>
            <View style={styles.interactionContainer}>
              <View style={styles.likeDislikeContainer}>
                <TouchableOpacity onPress={() => likePost(index)}>
                  <Text style={styles.buttonText}>👍 {topic.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => dislikePost(index)}>
                  <Text style={styles.buttonText}>👎 {topic.dislikes}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.button}
                onPress={() => toggleComments(index)}
              >
                <Text style={styles.buttonText}>
                  {topic.commentsCount} Comments
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
            {visibleComments[index] && (
              <>
                {topic.comments.slice(0, commentsShown).map((comment, idx) => (
                  <View key={comment.id} style={styles.comment}>
                    <Text style={styles.commentUser}>{comment.user}:</Text>
                    <Text style={styles.commentText}>{comment.comment}</Text>
                    {comment.image && (
                      <Image
                        source={{ uri: comment.image }}
                        style={styles.commentImage}
                      />
                    )}
                    <View style={styles.likeDislikeContainer}>
                      <TouchableOpacity onPress={() => likeComment(index, idx)}>
                        <Text style={styles.buttonText}>
                          👍 {comment.likes}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => dislikeComment(index, idx)}
                      >
                        <Text style={styles.buttonText}>
                          👎 {comment.dislikes}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Reply Section */}
                    {comment.replies.map((reply, replyIndex) => (
                      <View key={replyIndex} style={styles.reply}>
                        <Text style={styles.replyUser}>{reply.user}:</Text>
                        <Text style={styles.replyText}>{reply.reply}</Text>
                      </View>
                    ))}
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Write a reply..."
                      value={replies[index] || ""}
                      onChangeText={(text) =>
                        setReplies((prev) => ({ ...prev, [index]: text }))
                      }
                    />
                    <TouchableOpacity
                      style={styles.replyButton}
                      onPress={() =>
                        replyToComment(index, comment.id, replies[index] || "")
                      }
                    >
                      <Text style={styles.replyButtonText}>Reply</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {commentsShown < topic.comments.length && (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={() => setCommentsShown(commentsShown + 2)}
                  >
                    <Text style={styles.loadMoreButtonText}>Load More</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.commentInputContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment..."
                    value={newComment[index] || ""}
                    onChangeText={(text) => handleCommentChange(index, text)}
                  />
                  <TouchableOpacity onPress={() => pickImage(index)}>
                    <Text style={styles.buttonText}>📷</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.commentButton}
                    onPress={() => addComment(index)}
                  >
                    <Text style={styles.commentButtonText}>Comment</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  searchInput: {
    padding: 8,
    backgroundColor: "#e1e1e1",
    borderRadius: 4,
    marginBottom: 10,
  },
  sortContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  sortButton: {
    padding: 10,
    backgroundColor: "#d1d1d1",
    borderRadius: 4,
  },
  sortActive: {
    backgroundColor: "#4caf50",
  },
  post: {
    backgroundColor: "#ffffff",
    marginBottom: 20,
    borderRadius: 8,
    padding: 10,
  },
  textContainer: {
    flex: 1,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  postDate: {
    fontSize: 14,
    color: "#888",
    marginVertical: 4,
  },
  postDescription: {
    fontSize: 16,
  },
  interactionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  likeDislikeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 80,
  },
  button: {
    padding: 8,
    backgroundColor: "#e1e1e1",
    borderRadius: 4,
  },
  buttonText: {
    fontSize: 14,
  },
  comment: {
    marginTop: 5,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderColor: "#ccc",
  },
  commentUser: {
    fontWeight: "bold",
  },
  commentText: {
    fontSize: 14,
  },
  commentImage: {
    width: 100,
    height: 100,
    marginTop: 5,
  },
  reply: {
    marginLeft: 20,
    borderLeftWidth: 1,
    borderColor: "#ddd",
    paddingLeft: 10,
  },
  replyUser: {
    fontWeight: "bold",
  },
  replyText: {
    fontSize: 14,
  },
  replyInput: {
    marginTop: 5,
    padding: 8,
    backgroundColor: "#e1e1e1",
    borderRadius: 4,
  },
  replyButton: {
    padding: 8,
    backgroundColor: "#4caf50",
    borderRadius: 4,
    marginTop: 5,
  },
  replyButtonText: {
    color: "#ffffff",
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  commentInput: {
    flex: 1,
    padding: 8,
    backgroundColor: "#e1e1e1",
    borderRadius: 4,
  },
  commentButton: {
    marginLeft: 8,
    padding: 8,
    backgroundColor: "#4caf50",
    borderRadius: 4,
  },
  commentButtonText: {
    color: "#ffffff",
    fontSize: 14,
  },
  loadMoreButton: {
    padding: 8,
    backgroundColor: "#4caf50",
    borderRadius: 4,
    marginTop: 10,
  },
  loadMoreButtonText: {
    color: "#ffffff",
  },
});

export default DiscussionPage;
