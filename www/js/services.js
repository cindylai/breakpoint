angular.module('breakpoint.services', [])

.service('parse', function() {
	Parse.initialize("YTjJBDfZmA8fdIC3gEZT9p7n2fp7lkg6tHYBMZ6N", "uLeLdclSTyOxKiJvO8B3CAaY8y0stiZWVlEJpG3q");
	return {
		getCategories: function() {
			var Category = Parse.Object.extend("Category");
			var query = new Parse.Query(Category).select(["name","url"]);
			return query.find();
		},

		getVideosForCategory: function(categoryUrl) {
			var Category = Parse.Object.extend("Category");
			// get category that matches url 
			var query = new Parse.Query(Category).equalTo("url", categoryUrl);
			return query.first().then(function(category) {
				var categoryId = category.id;
				var Video = Parse.Object.extend("Video");
				var query = new Parse.Query(Video)
				// get all videos that that are part of the category
				query.equalTo("categories", categoryId);
				// select youtube title and youtube video ID 
				query.select(["yt_title","yt_videoId"])
				return query.find();
			})
		},

		getCategory: function(categoryUrl) {
			var Category = Parse.Object.extend("Category");
			// get category that matches url 
			var query = new Parse.Query(Category).equalTo("url", categoryUrl);
			return query.first()
		},
	}
})