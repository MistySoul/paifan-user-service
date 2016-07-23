/*
    Convert an array to a string to store it in cache.
    If it's an empty array, a "0" will be returned because Redis does not allow empty list.
*/
exports.jsonifyArray = function (array) {
    var result = [];

    if (array == null || array.length == 0) {
        result.push("0");
        return result;
    }

    for (var i = 0; i < array.length; i++) {
        result.push(JSON.stringify(array[i]));
    }

    return result;
}

/*
    Gets a specified range of array to a new array.
    It will deserialize the JSON for each item if deserializeJson is set to true.
*/
exports.getRangeOfArray = function(array, startIndex, endIndex, deserializeJson) {
    var result = [];

    if (array == null)
        return result;

    if (deserializeJson) {
        for (var i = startIndex; i <= endIndex && i < array.length; i++) 
            result.push(JSON.parse(array[i]));
    } else {
        for (var i = startIndex; i <= endIndex && i < array.length; i++) 
            result.push(array[i]);
    }

    return result;
};