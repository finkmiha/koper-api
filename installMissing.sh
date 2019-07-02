
name=$(npm start)

re="Error: Cannot find module '(.*)'
if [[ $name =~ $re ]]; then 
	echo ${BASH_REMATCH[1]}; 
fi


